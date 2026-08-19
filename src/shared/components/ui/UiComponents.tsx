import React, { type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react';

// ==========================================
// BUTTON COMPONENT
// ==========================================
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  };

  const variantStyles = {
    primary: 'bg-primary hover:bg-primary-container text-white focus:ring-primary/40 shadow-sm active:scale-95',
    secondary: 'bg-secondary-container hover:bg-secondary text-on-secondary-container hover:text-white focus:ring-secondary/40',
    outline: 'border border-outline-variant bg-transparent hover:bg-surface text-on-surface focus:ring-primary/30',
    danger: 'bg-error hover:bg-red-700 text-white focus:ring-error/40 shadow-sm active:scale-95',
    ghost: 'bg-transparent hover:bg-surface-variant text-on-surface-variant focus:ring-slate-300',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-400 shadow-sm active:scale-95',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};

// ==========================================
// INPUT COMPONENT
// ==========================================
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}
        <div className="relative rounded-xl shadow-sm">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm px-3.5 py-2.5 transition-colors focus:outline-none focus:ring-2 ${
              leftIcon ? 'pl-10' : ''
            } ${rightIcon ? 'pr-10' : ''} ${
              error
                ? 'border-error focus:border-error focus:ring-error/20'
                : 'border-slate-300 dark:border-slate-700 focus:border-primary focus:ring-primary/20'
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-error font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';

// ==========================================
// SELECT COMPONENT
// ==========================================
export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = '', id, ...props }, ref) => {
    const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={`w-full rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm px-3.5 py-2.5 focus:outline-none focus:ring-2 ${
            error
              ? 'border-error focus:border-error focus:ring-error/20'
              : 'border-slate-300 dark:border-slate-700 focus:border-primary focus:ring-primary/20'
          } ${className}`}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-error font-medium">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

// ==========================================
// MODAL COMPONENT
// ==========================================
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'md',
}) => {
  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className={`w-full ${maxWidthStyles[maxWidth]} bg-surface dark:bg-slate-900 rounded-3xl border border-outline-variant dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150`}
      >
        {title && (
          <div className="px-6 py-4 border-b border-outline-variant dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        )}
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-outline-variant dark:border-slate-800 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// BADGE COMPONENT
// ==========================================
export interface BadgeProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', size = 'md' }) => {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
  };

  const variantStyles = {
    primary: 'bg-primary/10 text-primary border border-primary/20',
    secondary: 'bg-secondary/10 text-secondary border border-secondary/20',
    success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    error: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
  };

  return (
    <span className={`inline-flex items-center font-bold rounded-lg ${sizeStyles[size]} ${variantStyles[variant]}`}>
      {children}
    </span>
  );
};

// ==========================================
// CARD COMPONENT
// ==========================================
export interface CardProps {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, title, subtitle, action, className = '' }) => {
  return (
    <div className={`bg-surface dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="px-5 py-4 border-b border-outline-variant dark:border-slate-800 flex items-center justify-between">
          <div>
            {typeof title === 'string' ? (
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{title}</h3>
            ) : (
              title
            )}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};

// ==========================================
// SEARCH INPUT COMPONENT
// ==========================================
export interface SearchInputProps extends Omit<InputProps, 'leftIcon'> {
  onClear?: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, onClear, placeholder = 'Pesquisar...', ...props }) => {
  return (
    <Input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      leftIcon={<span className="material-symbols-outlined text-lg">search</span>}
      rightIcon={
        value && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        ) : undefined
      }
      {...props}
    />
  );
};

// ==========================================
// PAGE HEADER COMPONENT
// ==========================================
export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-outline-variant dark:border-slate-800">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5 flex-wrap">{actions}</div>}
    </div>
  );
};
