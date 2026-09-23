"use client";

import { useEffect, useRef } from "react";
import "swagger-ui-dist/swagger-ui.css";

export function SwaggerViewer() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { SwaggerUIBundle } = await import("swagger-ui-dist");
      if (cancelled || !container.current) return;
      SwaggerUIBundle({
        url: "/api/v1/openapi.json",
        domNode: container.current,
        deepLinking: true,
        docExpansion: "list",
        defaultModelsExpandDepth: 1,
        tryItOutEnabled: true,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <div ref={container} className="rounded-xl border bg-white" />;
}
