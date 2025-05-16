import {
  createDragContext,
  DragProvider,
} from "@/components/providers/DragProvider";
import { GroupRecord } from "@/types";
import { ComponentProps, ReactNode, RefObject, useContext } from "react";

export const ApplicationDragContext = createDragContext<
  ApplicationDragContextType,
  GroupRecord
>();

export const useApplicationDragContext = () => {
  const context = useContext(ApplicationDragContext);
  if (!context) {
    throw new Error(
      "useApplicationDragContext must be used within a ApplicationDragProvider"
    );
  }
  return context;
};

type ApplicationDragContextType = {
  draggedApplications: GroupRecord[];
  setDraggedApplications: (applications: GroupRecord[]) => void;
};

export const ApplicationDragProvider = ({
  children,
  draggedApplications,
  setDraggedApplications,
  ...providerProps
}: {
  children: ReactNode;
  container: RefObject<HTMLElement | null>;
  draggedApplications: GroupRecord[];
  setDraggedApplications: (applications: GroupRecord[]) => void;
} & Omit<
  ComponentProps<typeof DragProvider<ApplicationDragContextType, GroupRecord>>,
  "dragContext" | "initialParams"
>) => {
  return (
    <DragProvider<ApplicationDragContextType, GroupRecord>
      {...providerProps}
      initialParams={{ draggedApplications, setDraggedApplications }}
      dragContext={ApplicationDragContext}
    >
      {children}
    </DragProvider>
  );
};
