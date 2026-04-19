import React, { useEffect, useState } from 'react';
import { MarkdownDocument } from '../components/legal/MarkdownDocument';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { getLegalDocument, LegalDocument } from '../api/legalApi';

export type LegalDocumentId = 'privacy' | 'terms';

type Props = {
  documentId: LegalDocumentId;
};

const LegalDocumentPage: React.FC<Props> = ({ documentId }) => {
  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setError(null);
    getLegalDocument(documentId)
      .then((d) => {
        if (!cancelled) setDoc(d);
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить документ. Попробуйте обновить страницу.');
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (error) {
    return (
      <section className="container" style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        <p role="alert">{error}</p>
      </section>
    );
  }

  if (!doc) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 16px' }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <section className="legal-document-page">
      <MarkdownDocument title={doc.title} markdown={doc.content} />
      <p className="legal-document-page__version">Версия документа: {doc.version}</p>
    </section>
  );
};

export default LegalDocumentPage;
