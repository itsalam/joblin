import { cn } from "@/lib/utils";
import { Root } from "@radix-ui/react-slot";
import { AnimatePresence, motion, MotionProps } from "framer-motion";
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

const SpinnerGap = motion.create(LoaderCircle);

export type EditInputProps = {
  iconSize?: number;
  containerClassName?: string;
  edit?: boolean;
  value?: string;
  placeHolder?: string;
  onFetch?: (e: FormEvent<HTMLInputElement>) => Promise<any>;
  validateValue?: (val?: string) => boolean;
} & ComponentProps<typeof Input>;

const isInputElement = (element: HTMLElement): element is HTMLInputElement => {
  return element.tagName.toLowerCase() === "input";
};

const setInputValue = (input: HTMLElement, value?: string) => {
  if (isInputElement(input)) {
    input.value = value ?? "";
  } else {
    input.innerText = value ?? "";
  }
};

function focusToEnd(el: HTMLElement) {
  el.focus();
  if (el.tagName.toLowerCase() === "input") {
    return;
  }

  const range = document.createRange();
  const selection = window.getSelection();

  range.selectNodeContents(el);
  range.collapse(false); // Collapse to the end

  selection?.removeAllRanges();
  selection?.addRange(range);
}

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
    validateValue = (val: string) => !!val,
    children,
    ...inputProps
  } = props;
  const inputRef = useRef<typeof motion.input>(null);
  const [prevValue, setPrevValue] = useState(value);
  const [valid, setValid] = useState<boolean>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const updateInput = (input: HTMLInputElement) => () => {
    const placeholderText = input?.getAttribute("placeholder");
    const valueText = input.value;
    const extraPadding = 8;
    if (placeholderText && isInputElement(input)) {
      // Create a temporary span element to measure the placeholder text width
      const tempSpan = document.createElement("span");
      tempSpan.style.visibility = "hidden";
      tempSpan.style.whiteSpace = "nowrap";
      tempSpan.style.fontSize = window.getComputedStyle(input).fontSize;
      tempSpan.style.fontFamily = window.getComputedStyle(input).fontFamily;

      tempSpan.innerText =
        placeholderText.length > (valueText?.length ?? 0)
          ? placeholderText
          : valueText;

      // Append the span to the body to get its width
      document.body.appendChild(tempSpan);
      const width = tempSpan.offsetWidth + extraPadding;

      // Remove the temporary span element
      document.body.removeChild(tempSpan);

      // Set the input width
      input.style.flexBasis = `${width}px`;
      input.style.width = `${width}px`;
    }
  };

  useEffect(() => {
    const input = inputRef.current as unknown as HTMLInputElement;
    const widthUpdater = updateInput(input);
    if (value && input) {
      setInputValue(input, value);
    }

    if (input) {
      input.addEventListener("input", widthUpdater);
      widthUpdater();
    }
    return () => input?.removeEventListener("input", widthUpdater);
  }, [inputRef, edit, value]);

  const focusInput: MouseEventHandler = (e) => {
    e.stopPropagation();
    console.log("focusInput", inputRef.current);
    if (inputRef.current) {
      focusToEnd(inputRef.current as unknown as HTMLInputElement);
    }
  };

  const isValid = (target: HTMLInputElement) => {
    const value = target?.value ?? (target as HTMLElement).innerText;
    return (
      validateValue(value) && !!target.validity === !!target.validity?.valid
    );
  };

  const onBlurEvent = (
    event: Partial<Pick<React.FocusEvent<Element>, "target">>
  ) => {
    const target = event.target as HTMLInputElement;
    if (prevValue && !isValid(target)) {
      setInputValue(target, prevValue);
    } else if (target.value !== prevValue) {
    }
    updateInput(target)();
    setValid(undefined);
  };

  const onKeyEvent = (
    event: Partial<Pick<React.KeyboardEvent<Element>, "key" | "target">>
  ) => {
    const target = event.target as HTMLInputElement;
    const isValidTarget = isValid(target);
    if (isValidTarget) {
      setValid(true);
    } else {
      setValid(false);
    }
    console.log(isValidTarget);
    if ("key" in event) {
      if (event?.key === "Enter") {
        if (isValidTarget) {
          setValid(undefined);
        } else {
          setPrevValue(value ?? placeHolder);
          setInputValue(target, value ?? placeHolder);
        }
        target?.blur();
      }
      if (event?.key === "Escape") {
        setInputValue(target, prevValue ?? "");
        target?.blur();
      }
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (document.activeElement === inputRef.current) {
      if (inputRef.current) {
        focusToEnd(inputRef.current as unknown as HTMLInputElement);
      }
      return;
    }
    e.preventDefault();
  };

  const handleSubmit = (e: FormEvent<HTMLInputElement>) => {
    onFetch && setIsLoading(true);
    onFetch?.(e).then(() => {
      setIsLoading(false);
    });
  };

  return (
    <motion.span
      key="editInput"
      role="input"
      className={cn(
        "flex relative items-center w-fit h-fit", // Layout, Flexbox & Grid, Sizing
        "placeholder-gray-400 mr-7" // Typography, Margin
      )}
    >
      <Input
        onMouseDown={handleMouseDown}
        ref={inputRef}
        containerProps={{
          className: cn(
            "flex-initial rounded-sm border-none flex-1 w-auto",
            "p-0 overflow-hidden",
            containerClassName,
            {
              underline: valid !== undefined,
              "decoration-emerald-400": valid,
              "decoration-red-400": valid === false,
            }
          ),
        }}
        className={cn(className)}
        type="text"
        placeholder={value ?? placeHolder}
        onBlur={onBlurEvent}
        onFocus={(e) => {
          setPrevValue(
            (e.target as HTMLInputElement)?.value ??
              (e.target as HTMLInputElement)?.innerText
          );
        }}
        edit={edit}
        onKeyDown={onKeyEvent}
        onPaste={onKeyEvent}
        onSubmit={handleSubmit}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
        }}
        readOnly={!edit}
        children={children}
        asChild={!!children}
        {...inputProps}
      />

      <AnimatePresence mode="wait">
        {edit ? (
          <motion.div
            className="absolute -right-6"
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
              <EditButton onClick={focusInput} iconSize={iconSize} />
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
  React.ComponentPropsWithRef<typeof Root> &
    React.ComponentPropsWithRef<typeof motion.input> & {
      asChild?: boolean;
      disableFocus?: boolean;
      icon?: React.ReactNode;
      containerProps?: React.ComponentPropsWithRef<typeof motion.div>;
      initial?: MotionProps["initial"];
      variants?: MotionProps["variants"];
      transition?: MotionProps["transition"];
      edit?: boolean;
    }
>((
  {
    asChild,
    edit,
    disableFocus,
    containerProps,
    className,
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
  const [isEdited, setIsEdited] = useState<boolean>(false);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault(); // Prevent the default form submission behavior
      onSubmit?.(event);
    }
    onKeyDown?.(event);
  };

  const Comp = asChild ? Root : motion.input;

  return (
    <motion.div
      whileHover="hover"
      {...containerProps}
      className={cn(
        "flex items-center bg-transparent file:bg-transparent", // Layout, Flexbox & Grid, Backgrounds
        "rounded-full border-1 disabled:opacity-50 transition-all", // Borders, Effects, Transitions & Animation
        "group border-input py-2 px-3 placeholder:text-muted-foreground", // Etc.
        "ring-offset-background",
        {
          "has-focus:ring has-focus:ring-gray-400 has-focus:ring-offset-2 has-focus:outline-none":
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
        <Comp
          className={cn(
            "w-full bg-inherit focus:outline-none",
            className
          )}
          ref={(node: HTMLInputElement) => {
            inputRef.current = node;
            if (typeof ref === "function") {
              ref(node as any);
            } else if (ref) {
              (ref as React.RefObject<HTMLInputElement | null>).current = node;
            }
          }}
          onInput={(e) => {
            const target = e.target as HTMLInputElement;
            setInput(target.value ?? target.innerText);
            setIsEdited(true);
          }}
          onFocus={(e) => {
            onFocus?.(e);
          }}
          onBlur={(e) => {
            onBlur?.(e);
          }}
          onKeyDown={handleKeyDown}
          {...props}
        />

        {isEdited ? <span className="text-blue-400">*</span> : null}
        {edit && input?.length ? (
          <button
            className="group-has-focus:block hidden"
            onClick={() => {
              console.log("HUH");
              if (inputRef.current) {
                setInputValue(inputRef.current, "");
                setInput("");
                focusToEnd(inputRef.current);
                const event = new Event("input", { bubbles: true });
                inputRef.current.dispatchEvent(event);
              }
            }}
          >
            <X className="cursor-pointer" size={14} />
          </button>
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
  const EditIcon = motion.create(PenLine);

  return (
    <motion.button
      ref={ref}
      className={cn(
        "flex relative justify-center items-center",
        className
      )}
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
