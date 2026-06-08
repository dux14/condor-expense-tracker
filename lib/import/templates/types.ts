export interface RawTransaction {
  date: string;        // 'yyyy-MM-dd'
  description: string; // raw merchant / description line
  amount: number;      // positive magnitude in `currency`
  currency: string;    // ISO 4217 (template's best guess; user can edit)
}

export interface StatementTemplate {
  id: string;                       // 'generic' | 'bancolombia' | …
  institution: string;             // human label, e.g. 'Genérico', 'Bancolombia'
  detect(text: string): boolean;   // true if this template recognizes the statement
  parse(text: string): RawTransaction[];
}
