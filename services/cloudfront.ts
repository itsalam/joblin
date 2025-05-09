/// <reference path="./../.sst/platform/config.d.ts" />

function buildCloudFrontStack(currentaccountId: string) {
    const cdnAssetBucket = new aws.s3.BucketV2("cdn-assets", {
        bucket: `cdn-assets-${currentaccountId}`,
        
        tags: {
            Name: "CDN Assets for users",
        },
    });

    const cdnAssetOriginId = "CDNS3Origin";

    const oac = new aws.cloudfront.OriginAccessControl("cdn-oac", {
        name: "cdn-oac",
        originAccessControlOriginType: "s3",
        signingBehavior: "always",
        signingProtocol: "sigv4",
      });

    const cdnAssetDistribution = new aws.cloudfront.Distribution("cdn_distribution", {
        origins: [{
            domainName: $util.interpolate`${cdnAssetBucket.bucket}.s3.amazonaws.com`,
            originId: cdnAssetOriginId,
            originAccessControlId: oac.id, // ✅ this line is key
        }],
        enabled: true,
        isIpv6Enabled: true,
        defaultCacheBehavior: {
            allowedMethods: [
                "DELETE",
                "GET",
                "HEAD",
                "OPTIONS",
                "PATCH",
                "POST",
                "PUT",
            ],
            cachedMethods: [
                "GET",
                "HEAD",
            ],
            targetOriginId: cdnAssetOriginId,
            forwardedValues: {
                queryString: false,
                cookies: {
                    forward: "none",
                },
            },
            viewerProtocolPolicy: "allow-all",
            minTtl: 0,
            defaultTtl: 3600,
            maxTtl: 86400,
        },
        orderedCacheBehaviors: [
            {
                pathPattern: "/emails/*",
                allowedMethods: [
                    "GET",
                    "HEAD",
                    "OPTIONS",
                ],
                cachedMethods: [
                    "GET",
                    "HEAD",
                    "OPTIONS",
                ],
                targetOriginId: cdnAssetOriginId,
                forwardedValues: {
                    queryString: false,
                    headers: ["Origin"],
                    cookies: {
                        forward: "none",
                    },
                },
                minTtl: 0,
                defaultTtl: 86400,
                maxTtl: 31536000,
                compress: true,
                viewerProtocolPolicy: "redirect-to-https",
            },
        ],
        priceClass: "PriceClass_200",
        restrictions: {
            geoRestriction: {
                restrictionType: "whitelist",
                locations: [
                    "US",
                    "CA",
                    "GB",
                    "DE",
                ],
            },
        },
        tags: {
            Environment: "production",
        },
        viewerCertificate: {
            cloudfrontDefaultCertificate: true,
        },
    });
    new aws.s3.BucketPolicy("cdn-bucket-policy", {
        bucket: cdnAssetBucket.id,
        policy: $util.all([cdnAssetBucket.arn, cdnAssetDistribution.arn]).apply(([bucketArn, distArn]) =>
          JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: {
                  Service: "cloudfront.amazonaws.com",
                },
                Action: "s3:GetObject",
                Resource: `${bucketArn}/*`,
                Condition: {
                  StringEquals: {
                    "AWS:SourceArn": distArn,
                  },
                },
              },
            ],
          })
        ),
      });
      
    return {cdnAssetBucket, cdnAssetDistribution}
}
export default buildCloudFrontStack;
