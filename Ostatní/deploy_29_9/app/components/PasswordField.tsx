'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function PasswordField({
  value,
  onChange,
  placeholder,
  className = '',
  inputClassName = '',
  buttonClassName = '',
  required,
  ariaInvalid,
  name,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  required?: boolean;
  ariaInvalid?: boolean;
  name?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <input
        type={visible ? 'text' : 'password'}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={ariaInvalid ? 'true' : 'false'}
        name={name}
        autoComplete={autoComplete}
        className={inputClassName}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className={buttonClassName}
        aria-label={visible ? 'Skrýt heslo' : 'Zobrazit heslo'}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
