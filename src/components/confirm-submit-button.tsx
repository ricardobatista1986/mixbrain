"use client";

import { useState } from "react";

type ConfirmSubmitButtonProps = {
  children: React.ReactNode;
  confirmLabel?: string;
  className?: string;
  confirmClassName?: string;
};

/**
 * Botão de submit com confirmação em duas etapas, para usar dentro de um
 * <form action={serverAction}>. No primeiro clique, troca para um estado de
 * confirmação (sem submeter nada); só o segundo clique de fato dispara o
 * submit do form pai. Evita depender de window.confirm (inconsistente em
 * mobile) e evita abrir um modal só para isso.
 */
export function ConfirmSubmitButton({
  children,
  confirmLabel = "Confirmar",
  className = "text-xs text-rose-400 hover:text-rose-300",
  confirmClassName = "text-xs font-bold text-rose-300 hover:text-rose-200",
}: ConfirmSubmitButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <button type="submit" className={confirmClassName}>
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs text-claude-text-faint hover:text-claude-text-muted"
        >
          Cancelar
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={className}
    >
      {children}
    </button>
  );
}
