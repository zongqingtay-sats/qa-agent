/**
 * Import page.
 *
 * Redirects to the generate page which subsumes the import
 * functionality via the "Documents" tab.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ImportPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/generate");
  }, [router]);
  return null;
}
