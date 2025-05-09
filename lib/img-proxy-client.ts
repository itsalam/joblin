import crypto from "crypto";
import { Resource } from "sst";


function base64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function urlSafeBase64(input: string): string {
  const encoded = Buffer.from(input).toString("base64");
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}


export function generateImgproxyUrl(sourceUrl: string): string {
  const encodedPath = `/${urlSafeBase64(sourceUrl)}`;
  console.log(encodedPath);
  const key = Buffer.from(Resource["ImgProxyKey"].value, "hex");
  const salt = Buffer.from(Resource["ImgProxySalt"].value, "hex");

  const hmac = crypto.createHmac("sha256", key);
  hmac.update(salt);
  hmac.update(encodedPath);
  const signature = urlSafeBase64(hmac.digest());

  return `${Resource["ImgProxyApi"].url}/${signature}${encodedPath}`;
}
