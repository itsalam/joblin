import { useEffect, useState } from "react";

export function useParams<T extends object>(
  dataObject: T,
  keys: (keyof T)[]
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [params, setParams] = useState<T>(
    keys.reduce((acc, key) => {
      acc[key] = dataObject[key];
      return acc;
    }, {} as T)
  );

  useEffect(() => {
    const newParams = keys.reduce((acc, key) => {
      acc[key] = dataObject[key];
      return acc;
    }, {} as T);

    // Only update state if different
    const changed = keys.some((key) => newParams[key] !== params[key]);
    if (changed) {
      setParams(newParams);
    }
  }, [dataObject, keys]);

  return [params, setParams];
}
