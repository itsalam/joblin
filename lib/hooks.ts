"use client";

import { FetchData } from "@/components/providers/DashboardProvider";
import { ApplicationStatus, DashboardParams, GroupRecord } from "@/types";
import { JSX, useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot, Root } from "react-dom/client";
import useSWR from "swr";
import { DateRanges, MAX_APPLICATION_PAGE_SIZE } from "./consts";

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

export const useDragPreview = (Preview: JSX.Element) => {
  const elementPromise = useRef<Promise<any> | null>(null);
  const ghostNode = useRef<HTMLElement | null>(null);
  const rootRef = useRef<Root>(null);

  const cleanupGhost = () => {
    try {
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
      }
      if (ghostNode.current) {
        ghostNode.current.remove();
        ghostNode.current = null;
      }
      if (elementPromise.current) {
        elementPromise.current
          .then(() => {
            elementPromise.current = null;
            cleanupGhost();
          })
          .catch(() => {
            // silent fail
            elementPromise.current = null;
          });
      }
    } catch (e) {}
  };

  function waitForImageLoad(
    img: HTMLImageElement
  ): Promise<HTMLImageElement | void> {
    return new Promise((resolve, reject) => {
      if (img.complete && img.naturalWidth !== 0) {
        resolve(img);
      } else {
        img.onload = () => resolve(img);
        img.onerror = reject; // Prevent hang
      }
    });
  }

  const onMouseOver = async () => {
    const [ghost, hasLoaded] = ((): [HTMLDivElement, boolean] => {
      const existing = document.querySelector("div#dragPreview");
      if (!!existing) {
        return [existing as HTMLDivElement, true];
      }
      return [document.createElement("div"), false];
    })();

    ghost.setAttribute("id", "dragPreview");
    const root = rootRef.current ?? createRoot(ghost);
    if (rootRef.current === null) {
      rootRef.current = root;
    }

    flushSync(() => {
      root.render(Preview); // <- React will immediately render this to ghost
    });

    Object.assign(ghost.style, {
      position: "absolute",
      top: "-1000px", // off-screen
      left: "-1000px",
    });

    ghost.classList.add("drag-preview");

    document.body.appendChild(ghost);
    ghost.getBoundingClientRect();
    await new Promise((r) => requestAnimationFrame(r));

    const img = ghost.querySelector("img");

    elementPromise.current = waitForImageLoad(img as HTMLImageElement)
      .then((img) => {
        ghostNode.current = ghost;
        rootRef.current = root;
      })
      .catch((err) => {
        cleanupGhost();
      })
      .finally(() => {
        elementPromise.current = null;
      });
  };

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!ghostNode.current) return;
    const el = ghostNode.current;
    e.dataTransfer.setDragImage(el, -10, -10);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        cleanupGhost();
      });
    });
  }, []);

  return {
    onMouseOver,
    handleDragStart,
    cleanupGhost,
  };
};

export function useEmails({ params }: { params: DashboardParams }) {
  const {
    dateKey = DateRanges.Monthly,
    absolute,
    searchTerm,
    filters,
  } = params;

  return useSWR(
    `/api/dashboard/emails`,
    (e) => {
      const searchParams = new URLSearchParams({
        dateKey,
        absolute: absolute ? "true" : "false",
        searchTerm: searchTerm ?? "",
        filters: JSON.stringify(filters ?? []),
      });
      const url = `${e}?${searchParams.toString()}`;
      return fetch(url)
        .then(
          (res) =>
            res.json() as Promise<
              Partial<Pick<FetchData, "emails" | "chartData">>
            >
        )
        .then((data) => data);
    },
    {
      keepPreviousData: true,
    }
  );
}

const createPreFetchedApplication = (
  id: string,
  emails: CategorizedEmail[]
): GroupRecord => {
  const relatedEmails = emails.filter((email) => email.group_id === id);

  return {
    id,
    user_name: relatedEmails[0].user_name,
    company_title: relatedEmails[0].company_title,
    job_title: relatedEmails[0].job_title,
    email_ids: relatedEmails.reduce(
      (acc, email) => {
        const applicationStatus = email.application_status as ApplicationStatus;
        if (email.id) {
          if (!acc[applicationStatus]) {
            acc[applicationStatus] = [];
          }
          acc[applicationStatus] = acc[applicationStatus].concat([email.id]);
        }
        return acc;
      },
      {} as GroupRecord["email_ids"]
    ),
  };
};

const sortKeyFunctions: Partial<
  Record<
    keyof (GroupRecord & CategorizeEmailItem),
    (r1: GroupRecord, r2: GroupRecord) => number
  >
> = {
  last_updated: (r1, r2) => {
    if (r1.last_updated === undefined || r2.last_updated === undefined)
      return 0;
    return (
      new Date(r2.last_updated).getTime() - new Date(r1.last_updated).getTime()
    );
  },
};

export const sortBy = (key?: keyof GroupRecord) =>
  (a: GroupRecord, b: GroupRecord) => {
    const sortFunc = key ? sortKeyFunctions[key] : undefined;
    if (sortFunc) {
      return sortFunc(a, b);
    }
    if (key) {
      if (a[key] === undefined || b[key] === undefined) return 0;
      if (a[key] < b[key]) return -1;
      if (a[key] > b[key]) return 1;
      return 0;
    }
    return 0;
  };

export function useApplications({
  emails,
  params,
}: {
  emails?: CategorizedEmail[];
  params: DashboardParams;
}) {
  const [presorted, setPresorted] = useState(false);
  const [numGroups, setNumGroups] = useState<number>(0);
  const accumulatedData = useRef<Record<number, GroupRecord[]>>({});
  const hasFetched = useRef<Set<number>>(new Set());
  useEffect(() => {
    const groups = Array.from(
      new Map(
        emails?.map((email) => [
          email.group_id,
          createPreFetchedApplication(email.group_id, emails),
        ])
      ).values()
    );
    setNumGroups(groups.length);
    if (
      params.applicationSortKey &&
      ["id", "user_name", "company_title", "job_title"].includes(
        params.applicationSortKey
      )
    ) {
      //we can presort before fetching the full details
      groups.sort(sortBy(params.applicationSortKey));
      setPresorted(true);
    }
    for (let i = 0; i < Math.ceil(groups.length / 100); i++) {
      accumulatedData.current[i] = groups.slice(i * 100, (i + 1) * 100);
    }
  }, [params.applicationSortKey, emails]);

  const pageIndex = params.applicationPageIndex ?? 0;

  const firstIndex = pageIndex * MAX_APPLICATION_PAGE_SIZE;
  const lastIndex = Math.min(
    (pageIndex + 1) * MAX_APPLICATION_PAGE_SIZE,
    numGroups
  );

  const batchItemIndex = Math.floor(lastIndex / 100);

  const { data, ...swrResults } = useSWR(
    () => [
      `/api/dashboard/applications`,
      emails,
      hasFetched.current.has(batchItemIndex),
    ],
    ([url]) => {
      const ids = accumulatedData.current[batchItemIndex].map(
        (record) => record.id
      );
      return fetch(url, {
        method: "POST",
        body: JSON.stringify({
          emailIds: ids,
        }),
        headers: { "Content-Type": "application/json" },
      })
        .then((res) => res.json() as Promise<{ records: GroupRecord[] }>)
        .then((data) => {
          hasFetched.current.add(batchItemIndex);
          return data.records;
        });
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    }
  );

  useEffect(() => {
    if (data) {
      accumulatedData.current[batchItemIndex] = data;
      if (numGroups < 100) {
        setNumGroups(data.length);
      }
    }
  }, [data, batchItemIndex]);

  const sortedData = Object.entries(accumulatedData.current)
    .sort(([a], [b]) => Number(a) - Number(b))
    .flatMap(([, data]) => data)
    .sort(sortBy(params.applicationSortKey));

  const pageData = sortedData.slice(firstIndex, lastIndex);

  return {
    currPage: pageIndex,
    maxApplications: numGroups,
    ...swrResults,
    data: pageData,
    presorted,
  };
}
