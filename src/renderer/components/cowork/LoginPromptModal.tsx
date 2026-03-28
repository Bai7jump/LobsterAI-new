import React from 'react';
import { UserIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { i18nService } from '../../services/i18n';

interface LoginPromptModalProps {
  onLogin: () => void;
  onConfigureModel: () => void;
  onClose: () => void;
}

const LoginPromptModal: React.FC<LoginPromptModalProps> = ({
  onLogin,
  onConfigureModel,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" />

      {/* Modal */}
      <div
        className="relative w-80 rounded-xl shadow-2xl dark:bg-claude-darkSurface bg-white border dark:border-claude-darkBorder border-claude-border p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
            <UserIcon className="w-5 h-5 text-blue-500" />
          </div>
          <h3 className="text-sm font-semibold dark:text-claude-darkText text-claude-text mb-2">
            {i18nService.t('authLoginPromptTitle')}
          </h3>
          <p className="text-sm dark:text-claude-darkTextSecondary text-claude-textSecondary mb-5">
            {i18nService.t('authLoginPromptMessage')}
          </p>
          <div className="flex items-center gap-3 w-full">
            <button
              type="button"
              onClick={onConfigureModel}
              className="flex-1 px-4 py-2 text-sm rounded-lg dark:text-claude-darkText text-claude-text border dark:border-claude-darkBorder border-claude-border hover:bg-claude-surfaceHover dark:hover:bg-claude-darkSurfaceHover transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <Cog6ToothIcon className="w-4 h-4" />
              {i18nService.t('authLoginPromptConfigureBtn')}
            </button>
            <button
              type="button"
              onClick={onLogin}
              className="flex-1 px-4 py-2 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <UserIcon className="w-4 h-4" />
              {i18nService.t('authLoginPromptLoginBtn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPromptModal;
