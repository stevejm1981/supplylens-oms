import { PageHeader } from "@/components/page-header";
import { SwaggerViewer } from "./swagger";

export default function ApiDocsPage() {
  return (
    <div>
      <PageHeader
        title="API Documentation"
        description="OpenAPI 3.1 · spec at /api/v1/openapi.json"
        hint='Every document type is exposed under /api/v1. Click Authorize and use the demo key "demo-key-supplylens" to try requests live against this instance.'
      />
      <SwaggerViewer />
    </div>
  );
}
