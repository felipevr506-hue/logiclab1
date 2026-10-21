"use client";

import { useMemo, useRef, useState } from "react";
import {
  Clipboard,
  Download,
  FileUp,
  History,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { useAppState } from "@/lib/app-state";
import type { CodeVersion, ProgrammingLanguageId } from "@/lib/types";

const extensions: Record<ProgrammingLanguageId, string> = {
  javascript: "js",
  python: "py",
  java: "java",
  c: "c",
  cpp: "cpp",
};

const labels: Record<CodeVersion["reason"], string> = {
  run: "Execução",
  submit: "Envio",
  complete: "Conclusão",
  manual: "Salvamento manual",
  restore: "Antes de restaurar",
  import: "Importação",
  conflict: "Conflito preservado",
};

export function CodeVersionTools({
  scope,
  sourceId,
  language,
  code,
  title,
  onCodeChange,
}: {
  scope: CodeVersion["scope"];
  sourceId: string;
  language: ProgrammingLanguageId;
  code: string;
  title: string;
  onCodeChange: (code: string) => void;
}) {
  const { state, recordCodeVersion, restoreCodeVersion, saveCodeSnippet } =
    useAppState();
  const inputRef = useRef<HTMLInputElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const versions = useMemo(
    () =>
      state.codeVersions
        .filter((item) => item.sourceId === sourceId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [sourceId, state.codeVersions],
  );
  const selected =
    versions.find((version) => version.id === selectedId) ?? versions[0];

  const saveVersion = () => {
    recordCodeVersion({
      scope,
      sourceId,
      language,
      code,
      reason: "manual",
    });
    setNotice("Versão salva");
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 200_000) {
      setNotice("O arquivo deve ter no máximo 200 KB.");
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== extensions[language]) {
      setNotice(`Use um arquivo .${extensions[language]} nesta linguagem.`);
      return;
    }
    const importedCode = await file.text();
    recordCodeVersion({
      scope,
      sourceId,
      language,
      code: importedCode,
      reason: "import",
    });
    onCodeChange(importedCode);
    setNotice(`${file.name} importado`);
    if (inputRef.current) inputRef.current.value = "";
  };

  const downloadCode = () => {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sourceId.replace(/[^a-z0-9-]/gi, "-")}.${extensions[language]}`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Arquivo preparado");
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setNotice("Código copiado");
  };

  return (
    <div className="code-version-tools">
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={`.${extensions[language]}`}
        onChange={(event) => void importFile(event.target.files?.[0])}
      />
      <button type="button" onClick={saveVersion} title="Salvar versão">
        <Save /> <span>Salvar</span>
      </button>
      <button
        type="button"
        onClick={() => setHistoryOpen(true)}
        title="Abrir histórico de versões"
      >
        <History /> <span>Histórico ({versions.length})</span>
      </button>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title="Importar arquivo"
      >
        <FileUp /> <span>Importar</span>
      </button>
      <button type="button" onClick={downloadCode} title="Baixar código">
        <Download /> <span>Baixar</span>
      </button>
      <button
        type="button"
        onClick={() => void copyCode()}
        title="Copiar código"
      >
        <Clipboard /> <span>Copiar</span>
      </button>
      <button
        type="button"
        onClick={() => {
          saveCodeSnippet({ sourceId, title, language, code });
          setNotice("Trecho salvo no caderno");
        }}
        title="Salvar no caderno"
      >
        <Save /> <span>Caderno</span>
      </button>
      {notice && <small role="status">{notice}</small>}

      {historyOpen && (
        <div className="version-overlay" role="dialog" aria-modal="true">
          <section className="version-dialog">
            <header>
              <div>
                <History />
                <span>
                  <h2>Histórico de versões</h2>
                  <small>{title}</small>
                </span>
              </div>
              <button
                type="button"
                aria-label="Fechar histórico"
                onClick={() => setHistoryOpen(false)}
              >
                <X />
              </button>
            </header>
            {versions.length ? (
              <div className="version-content">
                <nav aria-label="Versões salvas">
                  {versions.map((version) => (
                    <button
                      type="button"
                      className={selected?.id === version.id ? "active" : ""}
                      key={version.id}
                      onClick={() => setSelectedId(version.id)}
                    >
                      <b>{labels[version.reason]}</b>
                      <small>
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(version.createdAt))}
                      </small>
                    </button>
                  ))}
                </nav>
                {selected && (
                  <div className="version-preview">
                    <div>
                      <b>Versão selecionada</b>
                      <CodeDiff code={selected.code} compareWith={code} />
                    </div>
                    <div>
                      <b>Versão atual</b>
                      <CodeDiff code={code} compareWith={selected.code} />
                    </div>
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => {
                        restoreCodeVersion(selected.id);
                        onCodeChange(selected.code);
                        setHistoryOpen(false);
                        setNotice("Versão restaurada; a atual foi preservada.");
                      }}
                    >
                      <RotateCcw /> Restaurar esta versão
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state compact">
                <History />
                <h3>Nenhuma versão registrada</h3>
                <p>Execute, envie ou salve o código para criar a primeira.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function CodeDiff({
  code,
  compareWith,
}: {
  code: string;
  compareWith: string;
}) {
  const lines = code.split("\n");
  const comparedLines = compareWith.split("\n");
  return (
    <pre className="code-diff">
      {lines.map((line, index) => (
        <span
          className={line !== comparedLines[index] ? "changed" : ""}
          key={`${index}-${line}`}
        >
          <i>{index + 1}</i>
          {line || " "}
        </span>
      ))}
    </pre>
  );
}
