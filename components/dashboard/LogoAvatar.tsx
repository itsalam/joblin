import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { memo, useCallback, useEffect, useState } from "react";

interface LogoAvatarProps {
  company: CategorizedEmail["company_title"];
  size?: number;
}

export const LogoAvatar = memo(LogoAvatarBase, (prevProps, nextProps) => {
  return (
    prevProps.company === nextProps.company && prevProps.size === nextProps.size
  );
});

export function LogoAvatarBase({ company, size = 48 }: LogoAvatarProps) {
  const baseURL = "/api/logo";
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogoUrl = async () => {
      try {
        // if (logoUrl) return; // already cached or set
        const searchParams = new URLSearchParams({
          company,
        });

        const url = `${baseURL}?${searchParams.toString()}`;
        const response = await fetch(url, {
          next: { revalidate: 1000 },
        });
        const data = await response.json();
        if (data.logo) {
          setLogoUrl(data.logo);
        } else {
          setError("No logo URL found in BIMI record");
        }
      } catch (err) {
        setError("Failed to fetch Logo");
        console.error(err);
      }
    };

    fetchLogoUrl();
  }, [company, logoUrl]);

  const CallbackAvatar = useCallback(({ logoUrl }: { logoUrl?: string }) => {
    return (
      <Avatar style={{ width: size, height: size }}>
        {logoUrl ? (
          <AvatarImage
            {...{ width: size, height: size }}
            src={logoUrl}
            alt={company.slice(0, 1).toLocaleLowerCase()}
          />
        ) : (
          <AvatarFallback>
            {company.slice(0, 1).toLocaleLowerCase()}
          </AvatarFallback>
        )}
      </Avatar>
    );
  }, []);

  return <CallbackAvatar logoUrl={logoUrl ?? undefined} />;
}
