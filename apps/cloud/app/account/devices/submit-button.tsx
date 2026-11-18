'use client';

import { useFormStatus } from 'react-dom';

type SubmitButtonProps = {
  children: string;
  className: string;
  disabled?: boolean;
  pendingLabel: string;
};

export default function SubmitButton({
  children,
  className,
  disabled = false,
  pendingLabel,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className={className} disabled={disabled || pending} type="submit">
      {pending ? pendingLabel : children}
    </button>
  );
}
