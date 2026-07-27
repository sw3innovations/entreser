/**
 * Biblioteca de UI — entre ser (design system portado do Claude Design).
 *
 * Ponto único de importação: `import { ESButton, DataTable } from '@/components/ui'`.
 * Componentes sem hooks são "shared" (usáveis em Server e Client Components);
 * os que usam estado/efeito são 'use client' (Dialog, Toast, ESTabs).
 */

// Ações
export { ESButton, type ESButtonProps } from './es-button'
export { QuickAction, type QuickActionProps } from './quick-action'
export { IconButton, type IconButtonProps } from './icon-button'

// Formulários
export { FormField, type FormFieldProps } from './form-field'
export { TextInput, type TextInputProps } from './text-input'
export { TextareaInput, type TextareaInputProps } from './textarea-input'
export { SelectInput, type SelectInputProps, type SelectOption } from './select-input'
export { CheckboxInput, type CheckboxInputProps } from './checkbox-input'
export { PasswordInput, type PasswordInputProps } from './password-input'
export { PhoneInput, maskPhoneBR, type PhoneInputProps } from './phone-input'
export { MoneyInput, formatCentavos, type MoneyInputProps } from './money-input'
export { DateInput, TimeInput, type DateInputProps, type TimeInputProps } from './date-input'

// Layout & estrutura
export { Container, type ContainerProps } from './container'
export { ESDivider, type ESDividerProps } from './es-divider'
export { ESCard, CardHeader, CardContent, CardFooter, type ESCardProps } from './es-card'
export { PageHeader, type PageHeaderProps } from './page-header'
export { SectionHeader, type SectionHeaderProps } from './section-header'

// Dados & listas
export { DataTable, type DataTableProps, type DataTableColumn } from './data-table'
export { Pagination, type PaginationProps } from './pagination'
export { ListItem, type ListItemProps } from './list-item'
export { EmptyState, type EmptyStateProps } from './empty-state'
export { InfoNote, type InfoNoteProps } from './info-note'
export { BackButton, type BackButtonProps } from './back-button'
export {
  RowActionsMenu,
  RowActionsItem,
  type RowActionsMenuProps,
  type RowActionsItemProps,
} from './row-actions-menu'

// Feedback
export { Dialog, type DialogProps } from './dialog'
export { ToastProvider, useToast, ToastContext, type ToastVariant } from './toast'
export { ESBadge, type ESBadgeProps } from './es-badge'
export { Tag, type TagProps } from './tag'
export { ESSpinner, type ESSpinnerProps } from './es-spinner'
export { ESSkeleton, type ESSkeletonProps } from './es-skeleton'
export { ESProgressBar, type ESProgressBarProps } from './es-progress-bar'

// Navegação & mídia
export { ESTabs, type ESTabsProps, type TabItem } from './es-tabs'
export { ESBreadcrumb, type ESBreadcrumbProps, type BreadcrumbItem } from './es-breadcrumb'
export { ESAvatar, type ESAvatarProps } from './es-avatar'

// Ícones
export * from './icons'
