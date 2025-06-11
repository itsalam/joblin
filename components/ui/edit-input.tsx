import { cn } from "@/lib/utils";
import { AnimatePresence, motion, MotionProps } from "framer-motion";
import { LoaderCircle, PenLine, X } from "lucide-react";
import {
  ComponentProps,
  FormEvent,
  forwardRef,
  MouseEvent,
  MouseEventHandler,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

const SpinnerGap = motion.create(LoaderCircle);

export type EditInputProps = {
  iconSize?: number;
  containerClassName?: string;
  edit?: boolean;
  onFetch?: (e: FormEvent<HTMLInputElement>) => Promise<any>;
  validateValue?: (val: string) => boolean;
  isTextArea?: boolean;
} & ComponentProps<typeof Input>;

const isInputElement = (element: HTMLElement): element is HTMLInputElement => {
  return element.tagName.toLowerCase() === "input";
};

const setInputValue = (
  input: HTMLInputElement,
  value?: ComponentProps<"input">["value"]
) => {
  const stringValue = value != null ? String(value) : "";

  if (isInputElement(input)) {
    input.value = stringValue;
  } else {
    (input as HTMLElement).innerText = stringValue;
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

export const EditInput = ({
  containerClassName,
  edit,
  iconSize = 16,
  placeholder,
  onFetch,
  onClick,
  value,
  ...inputProps
}: EditInputProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = (e: FormEvent<HTMLInputElement>) => {
    onFetch && setIsLoading(true);
    onFetch?.(e).then(() => {
      setIsLoading(false);
    });
  };

  return (
    <EditField isLoading={isLoading} edit={edit} iconSize={iconSize}>
      <Input
        containerProps={{
          className: containerClassName,
        }}
        placeholder={String(value || placeholder)}
        value={value}
        edit={edit}
        onSubmit={handleSubmit}
        onClick={(e) => {
          // e.stopPropagation();
          onClick?.(e);
        }}
        // readOnly={!edit}
        {...inputProps}
      />
    </EditField>
  );
};

export type InputProps = React.ComponentPropsWithRef<"div"> &
  React.ComponentPropsWithRef<typeof motion.input> & {
    isTextArea?: boolean;
    disableFocus?: boolean;
    icon?: React.ReactNode;
    validateValue?: (val: string) => boolean;
    containerProps?: React.ComponentPropsWithRef<typeof motion.div>;
    initial?: MotionProps["initial"];
    variants?: MotionProps["variants"];
    transition?: MotionProps["transition"];
    edit?: boolean;
    onValueChange?: (value: string) => void;
    extraPadding?: number;
  };

export const Input = forwardRef<typeof motion.input, InputProps>((
  {
    isTextArea,
    edit,
    disableFocus,
    containerProps,
    className,
    placeholder,
    validateValue,
    icon,
    initial,
    variants,
    transition,
    onSubmit,
    onInput,
    onFocus,
    onBlur,
    onKeyDown,
    onValueChange,
    value,
    extraPadding = 8,
    ...props
  },
  ref
) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [input, setInput] = useState<string>();
  const [prevValue, setPrevValue] = useState(value);
  const [valid, setValid] = useState<boolean>();
  const [isEdited, setIsEdited] = useState<boolean>(false);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    console.log("keydown", event);
    if (event.key === "Enter") {
      // event.preventDefault(); // Prevent the default form submission behavior
      onSubmit?.(event);
      (event.target as HTMLInputElement).blur();
    } else if (event.key === "Escape") {
      (event.target as HTMLInputElement).blur();
      onKeyDown?.(event);
    } else {
      onKeyDown?.(event);
    }
  };

  const Comp = isTextArea ? TextArea : motion.input;

  const updateInput = (input: HTMLInputElement) => () => {
    const valueText = input.value;
    const placeholderText = input?.getAttribute("placeholder");

    if ((placeholderText || valueText) && isInputElement(input)) {
      // Create a temporary span element to measure the placeholder text width
      const tempSpan = document.createElement("span");
      tempSpan.style.visibility = "hidden";
      tempSpan.style.whiteSpace = "nowrap";
      const computed = window.getComputedStyle(input);
      const relevantStyles = [
        "fontSize",
        "fontFamily",
        "fontWeight",
        "fontStyle",
        "fontVariant",
        "letterSpacing",
        "lineHeight",
        "textTransform",
        "textIndent",
        "wordSpacing",
        "direction",
      ];

      for (const prop of relevantStyles) {
        tempSpan.style[prop as any] = computed[prop as any];
      }

      tempSpan.innerText =
        ((placeholderText?.length ?? 0) > (valueText?.length ?? 0)
          ? placeholderText
          : valueText) ?? "";

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

  const isValid = (target: HTMLInputElement) => {
    const value = target?.value ?? (target as HTMLElement).innerText;
    return (
      (validateValue?.(value) ?? true) &&
      !!target.validity === !!target.validity?.valid
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

  const onPasteEvent = (
    event: Partial<
      Pick<
        React.ClipboardEvent<Element>,
        "target" | "clipboardData" | "preventDefault"
      >
    >
  ) => {
    event.preventDefault?.();
    const text = event.clipboardData?.getData("text/plain") ?? "";

    // Insert plain text at cursor position
    document.execCommand("insertText", false, text);
    onKeyEvent(event);
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

    if ("key" in event) {
      if (event?.key === "Enter") {
        if (isValidTarget) {
          setValid(undefined);
        } else {
          setPrevValue(value ?? placeholder);
          setInputValue(target, value ?? placeholder);
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
    e.stopPropagation();
    if (document.activeElement === inputRef.current) {
      focusToEnd(inputRef.current as unknown as HTMLInputElement);
      return;
    }
  };

  return (
    <motion.div
      whileHover="hover"
      {...containerProps}
      className={cn(
        "flex flex-initial overflow-hidden items-center", // Layout, Flexbox & Grid
        "w-auto bg-transparent file:bg-transparent", // Sizing, Backgrounds
        "rounded-sm border-1 border-none disabled:opacity-50", // Borders, Effects
        "transition-all group border-input placeholder:text-muted-foreground", // Transitions & Animation, Etc.
        "ring-offset-background",
        {
          "has-focus:ring has-focus:ring-gray-400 has-focus:ring-offset-2 has-focus:outline-none":
            !disableFocus && edit,
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
            {
              underline: valid !== undefined,
              "decoration-emerald-400": valid,
              "decoration-red-400": valid === false,
            },
            className
          )}
          ref={inputRef}
          onInput={(e) => {
            const target = e.target as HTMLInputElement;
            setInput(target.value ?? target.innerText);
            setIsEdited(true);
            onValueChange?.(target.value ?? target.innerText);
          }}
          onBlur={(e) => {
            onBlurEvent(e);
            onBlur?.(e);
          }}
          onMouseDown={handleMouseDown}
          onKeyDown={handleKeyDown}
          defaultValue={value}
          onPaste={onPasteEvent}
          onFocus={(e) => {
            setPrevValue(
              (e.target as HTMLInputElement)?.value ??
                (e.target as HTMLInputElement)?.innerText
            );
            onFocus?.(e);
          }}
          onSubmit={onSubmit}
          type="text"
          {...(isTextArea ? { contentEditable: edit } : { readOnly: !edit })}
          {...props}
        />

        {edit && isEdited ? (
          <span className="text-blue-400 text-xl/3">*</span>
        ) : null}
        {edit && input?.length ? (
          <button
            className="group-has-focus:block hidden"
            onClick={() => {
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

const TextArea = forwardRef<HTMLDivElement, InputProps>((
  { value, ...props },
  ref
) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      contentRef.current &&
      !document.activeElement?.isSameNode(contentRef.current)
    ) {
      contentRef.current.innerText = String(value ?? "");
    }
  }, [value]);

  return (
    <div
      ref={(node: HTMLDivElement) => {
        contentRef.current = node;
        if (typeof ref === "function") {
          ref(node as any);
        } else if (ref) {
          (ref as React.RefObject<HTMLDivElement | null>).current = node;
        }
      }}
      suppressContentEditableWarning={true}
      {...props}
    />
  );
});

type EditFieldProps = {
  edit?: boolean;
  iconSize?: number;
  children: ReactNode;
  isLoading?: boolean;
  focusSelector?: (element: HTMLElement) => HTMLElement | null;
};

export const EditField = ({
  edit,
  iconSize = 16,
  children,
  isLoading = false,
  focusSelector = (element: HTMLElement) =>
    element.querySelector("input, textarea, div[contenteditable=true]"),
}: EditFieldProps) => {
  const inputContainerRef = useRef<HTMLSpanElement>(null);

  const focusInput: MouseEventHandler = (e) => {
    const focusChild = focusSelector(
      inputContainerRef.current as unknown as HTMLInputElement
    );
    if (focusChild) {
      focusToEnd(focusChild as HTMLElement);
    }
  };

  return (
    <motion.span
      key="editInput"
      role="input"
      className={cn(
        "flex relative items-center w-fit h-fit", // Layout, Flexbox & Grid, Sizing
        "placeholder-gray-400 mr-7" // Typography, Margin
      )}
      ref={inputContainerRef}
    >
      {children}
      <AnimatePresence mode="wait">
        {edit ? (
          <motion.div
            className="absolute -right-6"
            key="editContainer"
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
              <EditButton
                onClick={(e) => {
                  focusInput(e);
                }}
                iconSize={iconSize}
              />
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.span>
  );
};

TextArea.displayName = "TextArea";
EditButton.displayName = "EditButton";
