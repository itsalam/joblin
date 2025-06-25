"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CatchAllLogicPage() {
  const params = useParams(); // { slug: ['a', 'b', 'c'] } or {} for root
  const router = useRouter();

  useEffect(() => {
    // Perform any logic here
    // Example: redirect to root
  }, [params, router]);

  return null; // Don't render anything
}
