"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";

interface StatsTableProps {
  title: string;
  data: Array<Record<string, any>>;
  columns: Array<{
    key: string;
    label: string;
    format?: (value: any, row: Record<string, any>) => string | React.ReactNode;
    className?: string;
  }>;
  className?: string;
}

export function StatsTable({ title, data, columns, className = "" }: StatsTableProps) {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-4">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.format && row[column.key] !== undefined 
                        ? column.format(row[column.key], row) 
                        : row[column.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}