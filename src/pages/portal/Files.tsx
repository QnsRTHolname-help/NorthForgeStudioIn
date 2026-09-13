import { useRef, useState } from 'react';
import { Download, FileUp, Trash2 } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { PortalHeader } from '@/components/portal/PortalHeader';
import { Button } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { filesService } from '@/services';
import { formatDateTime, formatBytes } from '@/lib/format';
import type { FileRecord } from '@/types';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Files (spec §26, §27). A private, per-client document area. Objects are
 * stored in the private `client-files` bucket under the client's id;
 * downloads open short-lived signed URLs and every access is authorised
 * by the database — Client A can never read Client B's documents.
 */
export default function Files() {
  usePageMeta({ title: 'Files', noIndex: true });
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const state = useAsync(() => filesService.list(), []);
  const items = state.data?.items ?? [];

  const upload = useMutation((file: File) => filesService.upload(file), {
    onSuccess: () => {
      toast.success('File uploaded');
      state.refetch().catch(() => undefined);
    },
  });

  const download = async (record: FileRecord) => {
    setBusyId(record.id);
    try {
      const url = await filesService.downloadUrl(record.storagePath);
      window.open(url, '_blank', 'noopener');
    } catch {
      toast.error('The file link could not be created.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = useMutation((record: FileRecord) => filesService.remove(record), {
    onSuccess: () => {
      toast.success('File deleted');
      state.refetch().catch(() => undefined);
    },
  });

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('Files up to 10 MB are supported.');
      return;
    }
    await upload.mutate(file).catch(() => undefined);
  };

  return (
    <div>
      <PortalHeader
        title="Files"
        description="Logos, documents and deliverables — private to your business."
        action={
          <Button
            size="sm"
            iconLeft={<FileUp className="h-3.5 w-3.5" />}
            loading={upload.pending}
            onClick={() => inputRef.current?.click()}
          >
            Upload file
          </Button>
        }
      />
      <input ref={inputRef} type="file" className="hidden" onChange={onPick} aria-label="Choose a file to upload" />
      {upload.error ? <p className="mb-3 text-xs text-danger">{upload.error}</p> : null}

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
        empty={
          <EmptyState
            title="No files yet"
            description="Upload a logo, brand asset or document and it will be stored privately for your account."
          />
        }
      >
        {items.length ? (
          <Panel title={`${items.length} file${items.length === 1 ? '' : 's'}`}>
            <div className="divide-y divide-line">
              {items.map((record) => (
                <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-fg">{record.name}</p>
                    <p className="mt-0.5 text-2xs text-faint">
                      {formatBytes(record.sizeBytes)} · {formatDateTime(record.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      iconLeft={<Download className="h-3.5 w-3.5" />}
                      loading={busyId === record.id}
                      onClick={() => {
                        void download(record);
                      }}
                    >
                      Download
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={<Trash2 className="h-3.5 w-3.5" />}
                      loading={remove.pending}
                      onClick={() => {
                        void remove.mutate(record).catch(() => undefined);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}
      </AsyncBoundary>

      <Panel className="mt-6" title="Private by default">
        <p className="text-[13px] leading-relaxed text-muted">
          Files are stored in a private bucket and shared through expiring links — there are no
          public URLs, and no other business can list or open your documents.
        </p>
      </Panel>
    </div>
  );
}
