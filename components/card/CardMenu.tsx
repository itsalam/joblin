import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Lightbulb,
  Settings,
  SlidersVertical,
  Store,
  User,
} from "lucide-react";
import React from "react";
import { Button } from "../ui/button";

function FilterMenu(props: { transparent?: boolean; vertical?: boolean }) {
  const { transparent, vertical } = props;
  const [open, setOpen] = React.useState(false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          onClick={() => setOpen(!open)}
          className={`h-full flex items-center text-xl hover:cursor-pointer shadow-none ${
            transparent
              ? "bg-transparent text-white hover:bg-transparent active:bg-transparent"
              : vertical
                ? "bg-transparent  hover:bg-transparent active:bg-transparent dark:text-white dark:hover:bg-transparent dark:active:bg-transparent"
                : "bg-lightPrimary text-zinc-500 p-3 hover:bg-gray-100 dark:bg-zinc-950 dark:text-white dark:hover:bg-white/20 dark:active:bg-white/10 px-3"
          } justify-center rounded-none font-bold transition duration-200`}
        >
          {vertical ? (
            <p className="text-2xl text-inherit hover:cursor-pointer">
              <SlidersVertical className="text-inherit fill-[currentColor]" />
            </p>
          ) : (
            <SlidersVertical className="h-6 w-6 text-inherit fill-[currentColor]" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="z-80 w-40 border-zinc-200 dark:border-zinc-800">
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <p className="flex cursor-pointer items-center gap-2 text-zinc-800 hover:font-medium hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white">
              <span>
                <User />
              </span>
              Panel 1
            </p>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <p className="mt-2 flex cursor-pointer items-center gap-2 pt-1 text-zinc-950 hover:font-medium hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white">
              <span>
                <Store />
              </span>
              Panel 2
            </p>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <p className="mt-2 flex cursor-pointer items-center gap-2 pt-1 text-zinc-950 hover:font-medium hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white">
              <span>
                <Lightbulb />
              </span>
              Panel 3
            </p>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <p className="mt-2 flex cursor-pointer items-center gap-2 pt-1 text-zinc-950 hover:font-medium hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white">
              <span>
                <Settings />
              </span>
              Panel 4
            </p>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default FilterMenu;
