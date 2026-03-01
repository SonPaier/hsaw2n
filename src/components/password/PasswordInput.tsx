import { useState } from 'react';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { PasswordValidationResult } from './passwordValidation';
import type { PasswordStrengthResult } from './passwordStrength';

interface PasswordInputProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  validation: PasswordValidationResult;
  strength: PasswordStrengthResult;
  placeholder?: string;
  showRequirements?: boolean;
  showStrength?: boolean;
  autoComplete?: string;
}

const PasswordInput = ({
  id = 'password',
  label,
  value,
  onChange,
  validation,
  strength,
  placeholder,
  showRequirements = true,
  showStrength = true,
  autoComplete = 'new-password',
}: PasswordInputProps) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  const requirementLabels: Record<string, string> = {
    minLength: t('password.req.minLength'),
    hasUppercase: t('password.req.hasUppercase'),
    hasLowercase: t('password.req.hasLowercase'),
    hasNumber: t('password.req.hasNumber'),
    hasSpecial: t('password.req.hasSpecial'),
    noSequence: t('password.req.noSequence'),
    noRepeating: t('password.req.noRepeating'),
    notCommon: t('password.req.notCommon'),
    noUsername: t('password.req.noUsername'),
  };

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? t('password.placeholder')}
          autoComplete={autoComplete}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          onClick={() => setVisible(!visible)}
          tabIndex={-1}
        >
          {visible ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>

      {/* Strength meter */}
      {showStrength && value.length > 0 && (
        <div className="space-y-1">
          <div className="flex gap-1 h-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  'flex-1 rounded-full transition-colors',
                  i < strength.score
                    ? strength.color
                    : 'bg-muted',
                )}
              />
            ))}
          </div>
          <p className="text-sm font-medium text-foreground">
            {t(strength.label)}
          </p>
        </div>
      )}

      {/* Requirements checklist */}
      {showRequirements && (
        <ul className="space-y-0.5 text-xs">
          {validation.requirements.map((req) => (
            <li
              key={req.key}
              className={cn(
                'flex items-center gap-1.5 transition-colors',
                req.met ? 'text-green-600' : 'text-muted-foreground',
              )}
            >
              {req.met ? (
                <Check className="h-3 w-3 flex-shrink-0" />
              ) : (
                <X className="h-3 w-3 flex-shrink-0" />
              )}
              {requirementLabels[req.key] ?? req.key}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PasswordInput;
