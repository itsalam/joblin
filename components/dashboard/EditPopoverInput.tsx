import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "cmdk";
import debounce from "debounce";
import { ChevronDown, Search } from "lucide-react";
import {
  ComponentProps,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { EditField, Input } from "../ui/edit-input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Separator } from "../ui/separator";
import { Spinner } from "../ui/spinner";

export function EditPopoverInput<T>({
  initialValue,
  edit,
  isLoading,
  placeholder,
  fetchItems = (value?: string) => Promise.resolve([]),
  renderItem = (item: T) => ({
    value: item,
    children: <>{String(item)}</>,
  }),
  extractSearchValue = (obj: T) => String(obj),
  ...props
}: {
  placeholder?: string;
  initialValue: T;
  edit?: boolean;
  isLoading?: boolean;
  fetchItems?: (value?: string) => Promise<T[]>;
  renderItem?: (item: T) => {
    children: ReactNode;
    value: T;
  };
  extractSearchValue?: (value: T) => string;
} & ComponentProps<typeof Input>) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [items, setItems] = useState<T[]>([]);
  const [fetching, setFetching] = useState(false);

  const updateItems = useCallback(
    debounce((value?: string) => {
      setFetching(true);
      fetchItems(value).then((items) => {
        setFetching(false);
        setItems(items);
      });
    }, 300),
    [fetchItems]
  );

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="w-full">
        <EditField edit={edit}>
          <p
            className={cn(
              "text-xs text-left text-zinc-600 dark:text-white",
              !!!extractSearchValue(value) && "text-muted-foreground"
            )}
          >
            {extractSearchValue(value) || placeholder || "Search..."}
          </p>
        </EditField>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--radix-popper-anchor-width)]"
        align="start"
        alignOffset={-31}
        onEscapeKeyDown={(e) => {
          if ((e.target as HTMLElement).closest("[cmdk-input]") !== null) {
            e.preventDefault();
          }
        }}
        onOpenAutoFocus={() => {
          updateItems();
        }}
      >
        <Command>
          <div
            className={cn(
              "grid grid-cols-[1fr_auto_auto] grid-flow-col gap-1 items-center", // Layout, Flexbox & Grid
              "rounded-sm has-focus:outline-none has-focus:ring", // Borders, Effects
              "transition-all group border-input", // Transitions & Animation, Etc.
              "placeholder:text-muted-foreground ring-offset-background",
              "has-focus:ring-gray-400 has-focus:ring-offset-1"
            )}
          >
            <CommandInput placeholder="Search framework..." asChild>
              <Input
                disableFocus
                icon={<Search className="w-4 h-4 mr-1.5" />}
                containerProps={{
                  className: "pl-2 py-3 border-1 border-accent",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    console.log("ohfuck", e.key);
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                className="text-no-wrap"
                edit={edit}
                extraPadding={2}
                role="combobox"
                aria-expanded={open}
                value={extractSearchValue(value)}
                isTextArea
                placeholder={String(value || placeholder)}
                onValueChange={(v) => {
                  updateItems(v);
                }}
                {...props}

                // onClick={() => }
              />
            </CommandInput>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size={"minimal"}
                  variant="ghost"
                  className="border-[inherit] h-6 aspect-square"
                >
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Save as new group</DropdownMenuItem>
                <DropdownMenuItem>Rename current group</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Separator orientation="horizontal" />
          <CommandList className="text-xs text-zinc-600 dark:text-white">
            <CommandEmpty className="text-zinc-400">
              {fetching ? (
                <div className="flex items-center gap-2">
                  <Spinner
                    size="small"
                    className="h-4 w-4 text-muted-foreground"
                  />
                  Loading...
                </div>
              ) : (
                "No results found."
              )}
            </CommandEmpty>
            <CommandGroup
              heading={
                fetching ? (
                  <div className="mx-2 my-1 flex items-center gap-1">
                    <Spinner
                      size="small"
                      className="h-4 w-4 text-muted-foreground"
                    />
                    Loading...
                  </div>
                ) : (
                  <p className="mx-2 my-1">Suggestions</p>
                )
              }
            >
              {items.map(renderItem).map(({ value, children }, i) => (
                <CommandItem
                  className="px-3 py-1.5 cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  key={`${extractSearchValue(value)}-${i}`}
                  value={extractSearchValue(value)}
                  onSelect={(itemValue) => {
                    const item = items.find(
                      (i) => extractSearchValue(i) === itemValue
                    );
                    if (!item) return;
                    setValue(item);
                    setOpen(false);
                  }}
                >
                  {children}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
