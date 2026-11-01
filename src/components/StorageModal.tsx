import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Button, Progress, Popconfirm, Typography, message } from 'antd';
import {
  DatabaseOutlined,
  SoundOutlined,
  BookOutlined,
  ClearOutlined,
  HistoryOutlined,
  BugOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '../store/useSettingsStore';
import {
  clearCacheStorage,
  clearTempData,
  clearVoiceModels,
  deleteAllBooks,
  formatBytes,
  loadStorageSummary,
  resetReadingPositions,
  type StorageSummary,
} from '../utils/storageInfo';

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after books/positions changed so the shelf can reload */
  onLibraryChanged: () => void;
  /** Called after every book was deleted (leave the reader) */
  onLibraryCleared: () => void;
}

interface RowProps {
  icon: React.ReactNode;
  title: string;
  detail: string;
  action: string;
  danger?: boolean;
  confirm: string;
  disabled?: boolean;
  onRun: () => Promise<void>;
}

const Row: React.FC<RowProps> = ({ icon, title, detail, action, danger, confirm, disabled, onRun }) => {
  const [busy, setBusy] = useState(false);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ fontSize: 20, color: 'var(--primary)', width: 28, textAlign: 'center' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text strong style={{ display: 'block' }}>
          {title}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {detail}
        </Text>
      </div>
      <Popconfirm
        title={confirm}
        okText="Xoá"
        cancelText="Huỷ"
        okButtonProps={{ danger: true }}
        disabled={disabled}
        onConfirm={async () => {
          setBusy(true);
          try {
            await onRun();
          } finally {
            setBusy(false);
          }
        }}
      >
        <Button size="small" danger={danger} loading={busy} disabled={disabled} style={{ flexShrink: 0 }}>
          {action}
        </Button>
      </Popconfirm>
    </div>
  );
};

/** Browser storage overview with one-tap cleanup of caches, voice models, logs and saved data. */
export const StorageModal: React.FC<Props> = ({ open, onClose, onLibraryChanged, onLibraryCleared }) => {
  const [info, setInfo] = useState<StorageSummary | null>(null);
  const { resetSettings, setNeuralModelDownloaded } = useSettingsStore();

  const refresh = useCallback(async () => {
    try {
      setInfo(await loadStorageSummary());
    } catch {
      setInfo(null);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const run = (fn: () => Promise<void> | void, done: string) => async () => {
    try {
      await fn();
      message.success(done);
    } catch {
      message.error('Không thực hiện được, hãy thử lại');
    }
    await refresh();
  };

  const percent = info?.usage != null && info.quota ? Math.min(100, (info.usage / info.quota) * 100) : 0;
  const cacheDetail = info
    ? info.caches.count === 0
      ? 'Không có cache nào'
      : `${info.caches.entries} mục · ${formatBytes(info.caches.bytes)}`
    : '…';

  return (
    <Modal title="Bộ nhớ & cache" open={open} onCancel={onClose} footer={null} destroyOnHidden centered>
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text strong>Đang dùng</Text>
          <Text type="secondary">
            {formatBytes(info?.usage)} / {formatBytes(info?.quota)}
          </Text>
        </div>
        <Progress percent={Number(percent.toFixed(1))} showInfo={false} size="small" />
      </div>

      <Row
        icon={<ClearOutlined />}
        title="Cache trình duyệt"
        detail={cacheDetail}
        action="Dọn cache"
        confirm="Xoá toàn bộ cache trình duyệt? Sách của bạn không bị ảnh hưởng."
        disabled={!info || info.caches.count === 0}
        onRun={run(clearCacheStorage, 'Đã dọn cache')}
      />
      <Row
        icon={<SoundOutlined />}
        title="Mô hình giọng đọc (tải về máy)"
        detail={info ? formatBytes(info.model.bytes) : '…'}
        action="Xoá mô hình"
        confirm="Xoá mô hình giọng đã tải? Muốn dùng lại phải tải lại."
        disabled={!info || !info.model.bytes}
        onRun={run(async () => {
          await clearVoiceModels();
          setNeuralModelDownloaded(false);
        }, 'Đã xoá mô hình giọng')}
      />
      <Row
        icon={<BugOutlined />}
        title="Nhật ký âm thanh"
        detail={info ? `${info.log.lines} dòng` : '…'}
        action="Xoá nhật ký"
        confirm="Xoá nhật ký âm thanh?"
        disabled={!info || info.log.lines === 0}
        onRun={run(clearTempData, 'Đã xoá nhật ký')}
      />
      <Row
        icon={<HistoryOutlined />}
        title="Vị trí đã đọc"
        detail="Quay mọi sách về đầu, vẫn giữ sách"
        action="Đặt lại"
        confirm="Xoá vị trí đọc và tiến độ của tất cả sách?"
        disabled={!info || info.books.count === 0}
        onRun={run(async () => {
          await resetReadingPositions();
          onLibraryChanged();
        }, 'Đã đặt lại vị trí đọc')}
      />
      <Row
        icon={<UndoOutlined />}
        title="Cài đặt hiển thị & giọng"
        detail="Giao diện, cỡ chữ, tốc độ, giọng đã chọn"
        action="Đặt lại"
        confirm="Đặt lại toàn bộ cài đặt về mặc định?"
        onRun={run(() => resetSettings(), 'Đã đặt lại cài đặt')}
      />
      <Row
        icon={<BookOutlined />}
        title="Thư viện sách"
        detail={info ? `${info.books.count} sách · ${formatBytes(info.books.bytes)}` : '…'}
        action="Xoá tất cả sách"
        danger
        confirm="Xoá TOÀN BỘ sách khỏi thiết bị? Không thể khôi phục."
        disabled={!info || info.books.count === 0}
        onRun={run(async () => {
          await deleteAllBooks();
          onLibraryCleared();
        }, 'Đã xoá toàn bộ sách')}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
        <DatabaseOutlined style={{ color: 'var(--muted)' }} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Số liệu do trình duyệt ước tính, có thể lệch nhẹ.
        </Text>
        <Button size="small" type="link" onClick={() => void refresh()}>
          Làm mới
        </Button>
      </div>
    </Modal>
  );
};
