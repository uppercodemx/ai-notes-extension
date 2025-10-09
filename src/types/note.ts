export interface Note {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  aliases?: string[];
  starred?: boolean;
  createdAt: number;
  updatedAt: number;
}
