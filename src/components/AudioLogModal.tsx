import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, Space, Typography, message } from 'antd';
import { CopyOutlined, DeleteOutlined, ReloadOutlined, SelectOutlined } from '@ant-design/icons';
import { clearAudioLog, getAudioLog } from '../utils/audioDebugLog';

const { Text } = Typography;

// navigator.clipboard only exists on https / localhost; the dev server is reached over plain http on the LAN
const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Shows the persisted audio/lifecycle log (useful to debug screen-locked playback on iOS). */
export const AudioLogModal: React.FC<Props> = ({ open, onClose }) => {
  const [lines, setLines] = useState<string[]>([]);
  const preRef = useRef<HTMLPreElement>(null);

  const refresh = () => setLines(getAudioLog().slice().reverse());

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const copy = async () => {
    if (await copyText(getAudioLog().join('\n'))) {
      message.success('Đã sao chép nhật ký');
    } else {
      selectAll();
      message.info('Đã chọn sẵn toàn bộ nhật ký, hãy bấm "Sao chép" trên menu của iPhone');
    }
  };

  const selectAll = () => {
    const el = preRef.current;
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
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
        <Button size="small" icon={<SelectOutlined />} onClick={selectAll}>
          Chọn hết
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
        ref={preRef}
        style={{
          userSelect: 'text',
          WebkitUserSelect: 'text',
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
