import { Download, FileSpreadsheet } from "lucide-react";

import { ENTITIES } from "@/lib/data-transfer";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ImportForm } from "./import-form";

export default function DataPage() {
  return (
    <div>
      <PageHeader
        title="Import / Export"
        hint="Customer onboarding in CSVs. Export any register (it doubles as the import template), fill it in, import it back. Files import in the numbered order, later entities reference earlier ones by code. Every row is validated first: any error anywhere rejects the whole file with row-numbered problems, so nothing half-loads. Re-importing is safe, rows upsert by their natural key, and blank cells leave existing values unchanged."
      />

      <div className="grid gap-6">
        {ENTITIES.map((entity, index) => (
          <Card key={entity.key}>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">
                  <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                  {entity.title}
                  <Badge variant="outline" className="ml-2 font-mono text-[10px]">
                    key: {entity.naturalKey}
                  </Badge>
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{entity.description}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={`/data/export/${entity.key}`} download>
                    <Download className="size-3.5" /> Export CSV
                  </a>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <a href={`/data/export/${entity.key}?template=1`} download>
                    <FileSpreadsheet className="size-3.5" /> Template
                  </a>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <ImportForm entity={entity.key} />
              <details className="group">
                <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground">
                  Column mapping, what goes where
                </summary>
                <div className="mt-2 overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Column</TableHead>
                        <TableHead>Required</TableHead>
                        <TableHead>Maps to</TableHead>
                        <TableHead className="pr-4">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entity.columns.map((col) => (
                        <TableRow key={col.name}>
                          <TableCell className="pl-4 font-mono text-xs font-medium">
                            {col.name}
                          </TableCell>
                          <TableCell>
                            {col.required ? (
                              <Badge className="border-transparent bg-primary/10 text-primary">
                                required
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">optional</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {col.maps}
                          </TableCell>
                          <TableCell className="pr-4 text-xs text-muted-foreground">
                            {col.notes ?? ", "}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
