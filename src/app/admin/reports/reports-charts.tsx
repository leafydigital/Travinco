'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type CategoryDatum = { name: string; value: number };

export function ReportsCharts({
  incomeByCategory,
  expensesByCategory,
}: {
  incomeByCategory: CategoryDatum[];
  expensesByCategory: CategoryDatum[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink-800">Income by category</h2>
        {incomeByCategory.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-400">No income in this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={incomeByCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6e8eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`} />
              <Bar dataKey="value" fill="#137e65" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink-800">Expenses by category</h2>
        {expensesByCategory.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-400">No expenses in this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={expensesByCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6e8eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`} />
              <Bar dataKey="value" fill="#d85a30" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
