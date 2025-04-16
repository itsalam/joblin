import { animate } from "motion/react";
import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { ErrorMessages, PasswordErrorFlags } from "./schema";

interface SignUpContextProps {
    showPassword: boolean;
    setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
    passwordReqs: PasswordErrorFlags;
    setPasswordReqs: React.Dispatch<React.SetStateAction<PasswordErrorFlags>>;
    fetching: boolean;
    setIsFetching: React.Dispatch<React.SetStateAction<boolean>>;
    userUuid?: string;
    setUserUuid: React.Dispatch<React.SetStateAction<string|undefined>>;
    goToPage: (page: number) => void;
  }
  
  const SignUpContext = createContext<SignUpContextProps | undefined>(undefined);
  
  export const SignUpProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [showPassword, setShowPassword] = useState(false);
    const [passwordReqs, setPasswordReqs] = useState<PasswordErrorFlags>({
      [ErrorMessages.PASSWORD_MIN_LENGTH]: 0,
      [ErrorMessages.PASSWORD_LOWERCASE]: 0,
      [ErrorMessages.PASSWORD_UPPERCASE]: 0,
      [ErrorMessages.PASSWORD_NUMBER]: 0,
      [ErrorMessages.PASSWORD_SPECIAL_CHAR]: 0,
    });
    const [userUuid, setUserUuid] = useState<string>();
    const [fetching, setIsFetching] = useState<boolean>(false);
    const goToPage = useCallback((page: number) => {
      requestAnimationFrame(() => {
        animate(
          "#manual-form>div",
          { x: `calc((-100% - 1.5rem) * ${page})` },
          {
            type: "spring",
            damping: 15,
            stiffness: 80,
          }
        );
      });
    }, []);
  
    return (
      <SignUpContext.Provider
        value={{
          showPassword,
          setShowPassword,
          passwordReqs,
          setPasswordReqs,
          fetching,
          setIsFetching,
          goToPage,
          userUuid, 
          setUserUuid
        }}
      >
        {children}
      </SignUpContext.Provider>
    );
  };
  
  export const useSignUpContext = () => {
    const context = useContext(SignUpContext);
    if (!context) {
      throw new Error("useSignUpContext must be used within a SignUpProvider");
    }
    return context;
  };