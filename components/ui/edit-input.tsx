import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { LoaderCircle, PenLine, X } from "lucide-react";
import {
  ComponentProps,
  FormEvent,
  forwardRef,
  MouseEvent,
  MouseEventHandler,
  ReactNode,
  useCallback,
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

const updateInputContent = (
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

const updateInputDimensions = (input: HTMLInputElement, extraPadding: number) =>
  () => {
    const applyRelevantStyles = (target: HTMLElement, source: HTMLElement) => {
      const computed = window.getComputedStyle(source);
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
        target.style[prop as any] = computed[prop as any];
      }
    };

    const getPredictedWidth = (
      dummyElement: HTMLElement,
      input: HTMLInputElement | HTMLElement,
      text: string,
      extraPadding: number,
      extraStyles: Partial<Record<keyof CSSStyleDeclaration, string>>
    ): number => {
      // Create a temporary span element to measure the text width
      applyRelevantStyles(dummyElement, input);
      for (const [key, value] of Object.entries(extraStyles)) {
        if (value) {
          dummyElement.style[key as any] = value;
        }
      }
      dummyElement.innerText = text;

      // Append the span to the body to get its width
      document.body.appendChild(dummyElement);
      const width = dummyElement.offsetWidth + extraPadding;

      // Remove the temporary span element
      document.body.removeChild(dummyElement);

      return width;
    };
    if (isInputElement(input)) {
      const valueText = input.value ?? (input as HTMLElement).innerText ?? "";
      const placeholderText =
        input?.placeholder ?? input?.getAttribute("data-placeholder");

      const textToMeasure =
        placeholderText.length > valueText.length ? placeholderText : valueText;
      // Create a temporary span element to measure the placeholder text width
      const tempSpan = document.createElement("span");
      const width = getPredictedWidth(
        tempSpan,
        input,
        textToMeasure,
        extraPadding,
        {
          visibility: "hidden",
          whiteSpace: "nowrap",
        }
      );
      // Set the input width
      input.style.flexBasis = `${width}px`;
      input.style.width = `${width}px`;
    }
  };

export type InputProps = React.ComponentPropsWithRef<"div"> &
  React.ComponentPropsWithRef<typeof motion.input> & {
    isTextArea?: boolean;
    disableFocus?: boolean;
    icon?: React.ReactNode;
    validateValue?: (val: string) => boolean;
    containerProps?: React.ComponentPropsWithRef<typeof motion.div>;
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
    extraPadding = 5,
    ...props
  },
  ref
) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [inputValue, setInputValue] = useState<string>();
  const [prevValue, setPrevValue] = useState(value);
  const [valid, setValid] = useState<boolean>();
  const [isEdited, setIsEdited] = useState<boolean>(false);
  const defaultValueRef = useRef<typeof value>(value);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
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

  const TextAreaDiv = useCallback(({
    ...props
  }: ComponentProps<typeof TextArea>) => {
    return <TextArea {...props} />;
  }, []);

  const Comp = isTextArea ? TextAreaDiv : motion.input;

  useEffect(() => {
    const input = inputRef.current as unknown as HTMLInputElement;
    const widthUpdater = updateInputDimensions(input, extraPadding);

    if (!isTextArea) {
      if (value && input) {
        updateInputContent(input, value);
      }
    }
    input.addEventListener("input", widthUpdater);
    widthUpdater();

    return () => input.removeEventListener("input", widthUpdater);
  }, [inputRef, edit, value]);

  useEffect(() => {
    setIsEdited(false);
    if (!edit) {
      const input = inputRef.current as unknown as HTMLInputElement;
      updateInputContent(input, value);
      setInputValue(String(value));
    }
  }, [edit]);

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
    if (!isValid(target)) {
      updateInputContent(target, prevValue || value);
      setInputValue(String(prevValue || value));
    }
    updateInputDimensions(target, extraPadding)();
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
          updateInputContent(target, value ?? placeholder);
        }
        target?.blur();
      }
      if (event?.key === "Escape") {
        updateInputContent(target, prevValue ?? "");
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
        onBlur={(e) => {
          if (
            !e.relatedTarget ||
            inputRef.current
              ?.closest("[role='input']")
              ?.contains(e.relatedTarget)
          ) {
            // Focus is still inside the parent – ignore
            return;
          }
          onBlurEvent(e);
          onBlur?.(e);
        }}
        onInput={(e) => {
          const target = e.target as HTMLInputElement;
          const value = target.value ?? target.innerText;
          setInputValue(value);
          setIsEdited(true);
          onValueChange?.(value);
        }}
        onClick={handleMouseDown}
        onKeyDown={handleKeyDown}
        onPaste={onPasteEvent}
        onFocus={(e) => {
          setPrevValue(
            (e.target as HTMLInputElement)?.value ??
              (e.target as HTMLInputElement)?.innerText
          );
          onFocus?.(e);
        }}
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
          type="text"
          data-placeholder={String(placeholder)}
          {...(isTextArea
            ? { contentEditable: edit, defaultValue: defaultValueRef.current }
            : { readOnly: !edit, value: inputValue })}
        />

        {edit && isEdited ? (
          <span className="text-blue-400 text-xl/3">*</span>
        ) : null}
        {edit && inputValue?.length ? (
          <button
            className=" group-has-focus:block hidden"
            onMouseDown={() => {
              if (inputRef.current) {
                updateInputContent(inputRef.current, "");
                setInputValue("");
                focusToEnd(inputRef.current);
                requestAnimationFrame(() => {
                  inputRef.current?.focus();
                });
                // const event = new Event("input", { bubbles: true });
                // inputRef.current.dispatchEvent(event);
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
  { defaultValue, ...props },
  ref
) => {
  const contentRef = useRef<HTMLDivElement>(null);

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
    >
      {defaultValue}
    </div>
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
            className="absolute -right-5"
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
