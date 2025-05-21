import { Avatar, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import { memo, useMemo } from "react";
import { useCachedLogo } from "../helpers";

interface LogoAvatarProps {
  company: CategorizedEmail["company_title"];
  size?: number;
  isLoading?: boolean;
}

export const LogoAvatar = memo(LogoAvatarBase, (prevProps, nextProps) => {
  return (
    prevProps.company === nextProps.company && prevProps.size === nextProps.size
  );
});

function LogoAvatarBase({
  children,
  company,
  size = 48,
  isLoading = false,
  ...props
}: Partial<React.ComponentPropsWithoutRef<typeof Image>> & LogoAvatarProps) {
  const logoUrl = useCachedLogo(company, size, isLoading);

  const CallbackAvatar = useMemo(() => {
    return (
      <Avatar style={{ width: size, height: size }}>
        <AvatarImage
          {...props}
          {...{ width: size, height: size }}
          src={logoUrl}
          alt={company.slice(0, 1).toLocaleLowerCase()}
        />
        {children}
      </Avatar>
    );
  }, [logoUrl]);

  return CallbackAvatar;
}
