import React, { useEffect, useState } from 'react';
import { Modal, Button, Space, Typography, message } from 'antd';
import { CopyOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { clearAudioLog, getAudioLog } from '../utils/audioDebugLog';

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Shows the persisted audio/lifecycle log (useful to debug screen-locked playback on iOS). */
export const AudioLogModal: React.FC<Props> = ({ open, onClose }) => {
  const [lines, setLines] = useState<string[]>([]);

  const refresh = () => setLines(getAudioLog().slice().reverse());

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getAudioLog().join('\n'));
      message.success('Đã sao chép nhật ký');
    } catch {
      message.error('Không sao chép được, hãy chụp màn hình');
    }
  };

  return (
    <Modal
      title="Nhật ký âm thanh"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      centered
    >
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
        Nghe vài câu, khoá màn hình 20–30 giây, mở lại rồi xem ở đây. Dòng mới nhất nằm trên cùng.
      </Text>
      <Space style={{ marginBottom: 8 }}>
        <Button size="small" icon={<ReloadOutlined />} onClick={refresh}>
          Làm mới
        </Button>
        <Button size="small" icon={<CopyOutlined />} onClick={copy}>
          Sao chép
        </Button>
        <Button
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => {
            clearAudioLog();
            refresh();
          }}
        >
          Xoá
        </Button>
      </Space>
      <pre
        style={{
          maxHeight: '50dvh',
          overflow: 'auto',
          margin: 0,
          padding: 10,
          fontSize: 11,
          lineHeight: 1.5,
          background: 'var(--surface-alt)',
          borderRadius: 8,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {lines.length ? lines.join('\n') : 'Chưa có sự kiện nào.'}
      </pre>
    </Modal>
  );
};
