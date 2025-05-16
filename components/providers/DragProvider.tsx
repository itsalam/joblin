"use client";

import { ApplicationStatus, GroupRecord } from "@/types";
import React, {
  Context,
  createContext,
  ReactNode,
  RefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface DragContextValue<D = any> {
  draggedData: RefObject<D | null>;
  isDragging: boolean;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  dragDataCallback?: (data: D, target?: HTMLElement) => void;
}

export const createDragContext = <T, D = any>(
  initialParams?: Partial<T> & DragContextValue<D>
): Context<T & DragContextValue<D>> => {
  type ContextType = DragContextValue<D> & T;
  return createContext<T & DragContextValue<D>>({
    ...initialParams,
    // other Partial<T> keys will just be missing, which is valid
  } as ContextType);
};
export type ApplicationData = Record<ApplicationStatus, number | null>[];

export type FetchData = {
  chartData: ApplicationData;
  emails: CategorizedEmail[];
  applications?: GroupRecord[];
};

export const DragProvider = <T, D>({
  container,
  children,
  dragDataCallback,
  dragEndCallback,
  initialParams,
  dragContext: DragContext,
}: {
  container: RefObject<HTMLElement | null>;
  children: ReactNode;
  dragDataCallback?: (data: D, target?: HTMLElement) => void;
  dragEndCallback?: (data: D, target?: HTMLElement) => void;
  initialParams: T;
  dragContext: Context<T & DragContextValue<D>>;
}) => {
  const draggedData = useRef<D>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (event: DragEvent) => {
    const data = event.dataTransfer?.getData("text/plain");
    if (data) {
      draggedData.current = JSON.parse(data) as D;
      dragDataCallback?.(draggedData.current, event.target as HTMLElement);
    }

    setIsDragging(true);
  };

  const handleDragEnd = (event: DragEvent) => {
    setIsDragging(false);
    const data = event.dataTransfer?.getData("text/plain");

    if (data) {
      draggedData.current = null;
      dragEndCallback?.(JSON.parse(data) as D, event.target as HTMLElement);
    }
  };

  useEffect(() => {
    const containerElement = container.current;
    if (!containerElement) return;
    containerElement.addEventListener("dragstart", handleDragStart);
    containerElement.addEventListener("dragend", handleDragEnd);
    containerElement.addEventListener("drop", handleDragEnd);
    return () => {
      containerElement.removeEventListener("dragstart", handleDragStart);
      containerElement.removeEventListener("dragend", handleDragEnd);
      containerElement.removeEventListener("drop", handleDragEnd);
    };
  }, []);

  return (
    <DragContext
      value={{
        ...initialParams,
        draggedData,
        isDragging,
        setIsDragging,
      }}
    >
      {children}
    </DragContext>
  );
};

export const useDrag = <T, D>(
  context: Context<T & DragContextValue<D>>
): DragContextValue => {
  const currContext = useContext(context);
  if (!currContext) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return currContext;
};
