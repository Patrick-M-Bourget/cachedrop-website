import type * as React from 'react';

export type IconName =
  | 'download' | 'arrow-right' | 'chevron-right' | 'terminal' | 'film' | 'drive' | 'sparkle' | 'list' | 'trend'
  | 'clock' | 'folder' | 'laptop' | 'box' | 'close' | 'check' | 'copy' | 'message' | 'trash' | 'shield';

export interface LinkTarget { href: string; label: React.ReactNode }

/** Pill (marketing) or rounded (dialogs) button. Renders <a> when href is set. */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  shape?: 'pill' | 'rounded';
  icon?: IconName;
  iconEnd?: IconName;
  href?: string;
}
export declare function Button(props: ButtonProps): React.ReactElement;

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { icon: IconName; label: string; href?: string; size?: number }
export declare function IconButton(props: IconButtonProps): React.ReactElement;

export interface ArrowLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> { tone?: 'accent' | 'ink'; size?: 'md' | 'lg'; arrow?: boolean }
export declare function ArrowLink(props: ArrowLinkProps): React.ReactElement;

export interface IconProps { name: IconName; size?: number; strokeWidth?: number; label?: string; className?: string; style?: React.CSSProperties }
export declare function Icon(props: IconProps): React.ReactElement;

export interface LogoProps { href?: string; beta?: boolean; markOnly?: boolean; size?: number; className?: string }
export declare function Logo(props: LogoProps): React.ReactElement;

export interface TagProps { children?: React.ReactNode; className?: string }
export declare function Tag(props: TagProps): React.ReactElement;

export interface StatusPillProps { tone?: 'neutral' | 'accent' | 'success' | 'danger'; dot?: boolean | 'success' | 'accent' | 'danger' | 'neutral'; children?: React.ReactNode; className?: string }
export declare function StatusPill(props: StatusPillProps): React.ReactElement;

export interface ChipProps { children?: React.ReactNode; className?: string }
export declare function Chip(props: ChipProps): React.ReactElement;

export interface InlineCodeProps { children?: React.ReactNode; className?: string }
export declare function InlineCode(props: InlineCodeProps): React.ReactElement;

export interface CodeBlockProps { code: string; label?: string; copyable?: boolean; copyLabel?: string; className?: string }
export declare function CodeBlock(props: CodeBlockProps): React.ReactElement;

export interface IconTileProps { icon: IconName; size?: 'sm' | 'md' | 'lg'; tone?: 'dev' | 'downloads'; className?: string }
export declare function IconTile(props: IconTileProps): React.ReactElement;

export interface FeatureCardProps { title: React.ReactNode; icon?: IconName; chips?: React.ReactNode[]; link?: LinkTarget; id?: string; headingLevel?: 2 | 3 | 4; children?: React.ReactNode; className?: string }
export declare function FeatureCard(props: FeatureCardProps): React.ReactElement;

export interface HowToPanelProps { title: React.ReactNode; variant?: 'outline' | 'fill'; note?: React.ReactNode; link?: LinkTarget; headingLevel?: 2 | 3 | 4; children?: React.ReactNode; className?: string }
export declare function HowToPanel(props: HowToPanelProps): React.ReactElement;

export interface SectionHeaderProps { title: React.ReactNode; eyebrow?: React.ReactNode; lede?: React.ReactNode; level?: 1 | 2 | 3; size?: 'md' | 'lg' | 'xl'; align?: 'start' | 'center'; className?: string }
export declare function SectionHeader(props: SectionHeaderProps): React.ReactElement;

export interface BreadcrumbProps { items: { label: React.ReactNode; href?: string }[]; className?: string }
export declare function Breadcrumb(props: BreadcrumbProps): React.ReactElement;

export interface TableOfContentsProps { items: LinkTarget[]; title?: string; className?: string }
export declare function TableOfContents(props: TableOfContentsProps): React.ReactElement;

export interface FAQListProps { items: { q: React.ReactNode; a: React.ReactNode }[]; variant?: 'default' | 'article'; headingLevel?: 2 | 3 | 4; className?: string }
export declare function FAQList(props: FAQListProps): React.ReactElement;

export interface StepListProps { items: { title: React.ReactNode; body?: React.ReactNode }[]; variant?: 'rows' | 'cards'; start?: number; headingLevel?: 2 | 3 | 4; className?: string }
export declare function StepList(props: StepListProps): React.ReactElement;

export interface CalloutProps { title: React.ReactNode; eyebrow?: React.ReactNode; link?: LinkTarget; className?: string }
export declare function Callout(props: CalloutProps): React.ReactElement;

export interface DataTableProps { columns: React.ReactNode[]; rows: React.ReactNode[][]; monoColumns?: number[]; caption?: string; className?: string }
export declare function DataTable(props: DataTableProps): React.ReactElement;

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> { id: string; label: React.ReactNode; optional?: boolean; error?: string }
export declare const TextField: React.ForwardRefExoticComponent<TextFieldProps & React.RefAttributes<HTMLInputElement>>;

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { id: string; label: React.ReactNode; optional?: boolean; monoHint?: boolean }
export declare const TextArea: React.ForwardRefExoticComponent<TextAreaProps & React.RefAttributes<HTMLTextAreaElement>>;

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> { id: string; label: React.ReactNode; hint?: React.ReactNode }
export declare function Checkbox(props: CheckboxProps): React.ReactElement;

export type Rating = 'angry' | 'meh' | 'neutral' | 'happy' | 'love';
export interface RatingScaleProps { value?: Rating | null; defaultValue?: Rating; onChange?: (value: Rating) => void; label?: string; className?: string }
export declare function RatingScale(props: RatingScaleProps): React.ReactElement;

export interface ModalProps { title: React.ReactNode; subtitle?: React.ReactNode; open?: boolean; onClose?: () => void; closeHref?: string; footer?: React.ReactNode; inline?: boolean; titleId?: string; children?: React.ReactNode; className?: string }
export declare function Modal(props: ModalProps): React.ReactElement | null;

export interface FeedbackData { rating: Rating | null; email: string; message: string; includeSpecs: boolean }
export interface FeedbackFormProps { onSubmit?: (data: FeedbackData) => void; onClose?: () => void; open?: boolean; inline?: boolean; defaultRating?: Rating }
export declare function FeedbackForm(props: FeedbackFormProps): React.ReactElement | null;

export interface NavLink { id?: string; label: React.ReactNode; href: string; onClick?: React.MouseEventHandler }
export interface NavBarProps { active?: string; links?: NavLink[]; homeHref?: string; ctaHref?: string; ctaLabel?: string; beta?: boolean; className?: string }
export declare function NavBar(props: NavBarProps): React.ReactElement;

export interface FooterColumn { title: string; links?: { label: React.ReactNode; href: string }[]; items?: React.ReactNode[] }
export interface FooterProps { columns?: FooterColumn[]; blurb?: React.ReactNode; legal?: React.ReactNode; status?: React.ReactNode; className?: string }
export declare function Footer(props: FooterProps): React.ReactElement;

export interface MacWindowProps { title?: string; appearance?: 'light' | 'dark'; label?: string; sidebar?: { label?: string; items: { icon: IconName; label: string; active?: boolean }[] }[]; style?: React.CSSProperties; children?: React.ReactNode; className?: string }
export declare function MacWindow(props: MacWindowProps): React.ReactElement;

export interface StorageBarProps { used: number; total: number; unit?: string; label?: string; caption?: React.ReactNode; meta?: boolean; className?: string }
export declare function StorageBar(props: StorageBarProps): React.ReactElement;

export interface ReviewRowProps { title: React.ReactNode; size: React.ReactNode; detail?: React.ReactNode; icon?: IconName; tone?: 'dev' | 'downloads'; actionLabel?: string; onReview?: () => void; className?: string }
export declare function ReviewRow(props: ReviewRowProps): React.ReactElement;

declare global {
  interface Window {
    CacheDrop: {
      Button: typeof Button; IconButton: typeof IconButton; ArrowLink: typeof ArrowLink; Icon: typeof Icon; Logo: typeof Logo;
      Tag: typeof Tag; StatusPill: typeof StatusPill; Chip: typeof Chip; InlineCode: typeof InlineCode; CodeBlock: typeof CodeBlock;
      IconTile: typeof IconTile; FeatureCard: typeof FeatureCard; HowToPanel: typeof HowToPanel; SectionHeader: typeof SectionHeader;
      Breadcrumb: typeof Breadcrumb; TableOfContents: typeof TableOfContents; FAQList: typeof FAQList; StepList: typeof StepList;
      Callout: typeof Callout; DataTable: typeof DataTable; TextField: typeof TextField; TextArea: typeof TextArea; Checkbox: typeof Checkbox;
      RatingScale: typeof RatingScale; Modal: typeof Modal; FeedbackForm: typeof FeedbackForm; NavBar: typeof NavBar; Footer: typeof Footer;
      MacWindow: typeof MacWindow; StorageBar: typeof StorageBar; ReviewRow: typeof ReviewRow;
    };
  }
}
