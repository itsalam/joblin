import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { LoaderCircle, PenLine, X } from "lucide-react";
import {
  ComponentProps,
  FormEvent,
  forwardRef,
  MouseEvent,
  MouseEventHandler,
  useEffect,
  useRef,
  useState,
} from "react";

type TextEvent =
  | React.ClipboardEvent<HTMLInputElement>
  | React.KeyboardEvent<HTMLInputElement>;

const SpinnerGap = motion(LoaderCircle);

export type EditInputProps = {
  iconSize?: number;
  containerClassName?: string;
  edit?: boolean;
  value?: string;
  placeHolder?: string;
  onFetch?: (e: FormEvent<HTMLInputElement>) => Promise<any>;
  validateValue?: (val?: string) => boolean;
} & ComponentProps<typeof Input>;

export const EditInput = (props: EditInputProps) => {
  const {
    className,
    containerClassName,
    edit,
    iconSize = 16,
    value,
    placeHolder,
    onFetch,
    onClick,
    validateValue = () => true,
    ...inputProps
  } = props;
  const inputRef = useRef<typeof motion.input>(null);
  const [isEdited, setIsEdited] = useState<boolean>(false);
  const [prevValue, setPrevValue] = useState(value);
  const [valid, setValid] = useState<boolean>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const updateInput = (input: HTMLInputElement) => () => {
    const placeholderText = input?.getAttribute("placeholder") ?? "";
    const valueText = input.value;
    const extraPadding = 3;
    // Create a temporary span element to measure the placeholder text width
    const tempSpan = document.createElement("span");
    tempSpan.style.visibility = "hidden";
    tempSpan.style.whiteSpace = "nowrap";
    tempSpan.style.fontSize = window.getComputedStyle(input).fontSize;
    tempSpan.style.fontFamily = window.getComputedStyle(input).fontFamily;

    tempSpan.innerText =
      placeholderText.length > valueText.length ? placeholderText : valueText;

    // Append the span to the body to get its width
    document.body.appendChild(tempSpan);
    const width = tempSpan.offsetWidth + extraPadding;

    // Remove the temporary span element
    document.body.removeChild(tempSpan);

    // Set the input width
    input.style.flexBasis = `${width}px`;
    input.style.width = `${width}px`;
  };

  useEffect(() => {
    const input = inputRef.current as unknown as HTMLInputElement;
    const widthUpdater = updateInput(input);
    if (value && input) {
      input.value = value;
    }

    if (input) {
      input.addEventListener("input", widthUpdater);
      widthUpdater();
    }
    return () => input?.removeEventListener("input", widthUpdater);
  }, [inputRef, edit, value]);

  const focusInput: MouseEventHandler = (e) => {
    e.stopPropagation();
    if (inputRef.current) {
      (inputRef.current as unknown as HTMLInputElement).focus();
    }
  };

  const onKeyEvent = (event: TextEvent) => {
    const input = event.target as HTMLInputElement;
    if (input.validity.valid && validateValue(input.value)) {
      setValid(true);
    } else {
      setValid(false);
    }
    if ("key" in event) {
      if (event?.key === "Enter") {
        if (input.validity.valid && validateValue(input.value)) {
          setValid(false);
        }
        input.blur();
      }

      if (event?.key === "Escape") {
        input.value = prevValue ?? "";
        input.blur();
      }
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (document.activeElement === inputRef.current) {
      if (inputRef.current) {
        (inputRef.current as unknown as HTMLInputElement).focus();
      }
      return;
    }
    e.preventDefault();
  };

  const handleSubmit = (e: FormEvent<HTMLInputElement>) => {
    setIsLoading(true);
    onFetch?.(e).then(() => {
      setIsLoading(false);
    });
  };

  return (
    <motion.span
      key="editInput"
      className={cn(
        "flex relative items-center w-fit h-fit placeholder-gray-400"
      )}
    >
      <Input
        onMouseDown={handleMouseDown}
        ref={inputRef}
        containerProps={{
          className: cn(
            "h-6 flex-initial rounded-sm border-none flex-1 w-auto",
            "p-0 overflow-hidden",
            containerClassName,
            {
              underline: valid !== undefined,
              "decoration-emerald-400": valid,
              "decoration-red-400": !valid,
            }
          ),
        }}
        className={cn(
          "pl-0",
          className
        )}
        type="text"
        placeholder={value ?? placeHolder}
        onBlur={(e) => {
          if (
            prevValue &&
            !(e.target.validity.valid && validateValue(e.target.value))
          ) {
            e.target.value = prevValue;
          } else if (e.target.value !== prevValue) {
            setIsEdited(true);
          }
          updateInput(e.target)();
          setValid(undefined);
        }}
        onFocus={(e) => setPrevValue(e.target.value)}
        onKeyDown={onKeyEvent}
        onPaste={onKeyEvent}
        onSubmit={handleSubmit}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
        }}
        readOnly={!edit}
        {...inputProps}
      />
      {isEdited ? <span className="text-blue-400">*</span> : null}

      <AnimatePresence mode="wait">
        {edit ? (
          <motion.div
            className="absolute -right-5"
            key="editContainer"

      // onAnimationStart={(def) => console.log(def)}
            exit="exit"
            whileHover={"hover"}
            initial={{
              opacity: [0, 1],
              scale: [0, 1],
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            variants={{
              hover: {
                scale: [null, 1.1],
              },
              exit: {
                opacity: 0,
                scale: 0,
              },
              // visible: {
              //   opacity: [1, 0],
              //   scale: [0, 1],
              // },
            }}
          >
            {isLoading ? (
              <SpinnerGap className="animate-loader-spin" size={16} />
            ) : (
              <EditButton onClick={focusInput} iconSize={iconSize}/>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.span>
  );
};

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<
  typeof motion.input,
  React.ComponentPropsWithRef<typeof motion.input> & {
    disableFocus?: boolean;
    icon?: React.ReactNode;
    containerProps?: React.ComponentPropsWithRef<typeof motion.input>;
    children?: React.ReactNode;
  }
>((
  {
    children,
    disableFocus,
    containerProps,
    className,
    type,
    icon,
    initial,
    variants,
    transition,
    onSubmit,
    onFocus,
    onBlur,
    onKeyDown,
    ...props
  },
  ref
) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [input, setInput] = useState<string>();
  const [focus, setFocus] = useState<boolean>(false);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault(); // Prevent the default form submission behavior
      onSubmit?.(event);
    }
    onKeyDown?.(event);
  };

  return (
    <motion.div
      whileHover="hover"
      {...containerProps}
      className={cn(
        "flex items-center h-10 bg-transparent file:bg-transparent", // Layout, Flexbox & Grid, Sizing, Backgrounds
        "rounded-full border-1 disabled:opacity-50 transition-all", // Borders, Effects, Transitions & Animation
        "group border-input py-2 px-3 placeholder:text-muted-foreground", // Etc.
        "ring-offset-background",
        {
          "has-[:focus]:ring-ring has-[:focus]:ring-offset-2 has-[:focus]:outline-none":
            !disableFocus,
        },
        containerProps?.className
      )}
    >
      {icon}
      <motion.div
        initial={initial}
        variants={variants}
        transition={transition}
        className={cn(
          "flex flex-1 items-center"
        )}
      >
        {children}
        <motion.input
          className={cn(
            "w-full bg-inherit focus:outline-none pl-1",
            className
          )}
          type={type}
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === "function") {
              ref(node as any);
            } else if (ref) {
              (ref as React.MutableRefObject<HTMLInputElement | null>).current =
                node;
            }
          }}
          onInputCapture={(e) => {
            setInput((e.target as HTMLInputElement).value);
          }}
          onFocus={(e) => {
            onFocus?.(e);
            setFocus(true);
          }}
          onBlur={(e) => {
            onBlur?.(e);
            setFocus(false);
          }}
          onKeyDown={handleKeyDown}
          {...props}
        />
        {focus && input?.length ? (
          <X
            className="cursor-pointer transition-all"
            size={12}
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.value = "";
                setInput("");
                const event = new Event("input", { bubbles: true });
                inputRef.current.dispatchEvent(event);
              }
            }}
          />
        ) : null}
      </motion.div>
    </motion.div>
  );
});
Input.displayName = "Input";

export type EditButtonProps = {
  iconSize?: number;
} & ComponentProps<typeof motion.button>;

export const EditButton = forwardRef<HTMLButtonElement, EditButtonProps>((
  props,
  ref
) => {
  const { iconSize = 16, className, ...buttonProps } = props;
  const EditIcon = motion(PenLine);

  return (
    <motion.button
      ref={ref}
      className={cn(
        "flex relative justify-center items-center",
        className
      )}
      onAnimationStart={(def) => console.log(def)}
      layout="position"
      key="editIcon"
      variants={{
        hover: { y: [null, -4] },
      }}
      style={{
        width: Math.floor(iconSize * 1.25),
        height: Math.floor(iconSize * 1.25),
      }}
      {...buttonProps}
    >
      <EditIcon size={iconSize} />
    </motion.button>
  );
});

EditButton.displayName = "EditButton";
