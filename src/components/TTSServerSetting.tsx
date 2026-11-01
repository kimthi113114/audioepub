import React, { useState } from 'react';
import { Button, Input, Space, Typography, message } from 'antd';
import { getTtsApiBase, setTtsApiBase } from '../utils/apiBase';

const { Text } = Typography;

/**
 * Optional address of a TTS server / Cloudflare Worker. Needed on the static (GitHub Pages) site, where
 * there is no /api/tts of its own. The page reloads so every service picks the new address up.
 */
export const TTSServerSetting: React.FC = () => {
  const [value, setValue] = useState<string>(getTtsApiBase());
  const current = getTtsApiBase();

  const save = () => {
    const v = value.trim();
    if (v && !/^https?:\/\//i.test(v)) {
      message.error('Địa chỉ phải bắt đầu bằng https://');
      return;
    }
    setTtsApiBase(v);
    message.success(v ? 'Đã lưu, đang tải lại...' : 'Đã xoá, đang tải lại...');
    window.setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div style={{ padding: '8px 10px', background: 'var(--surface-alt)', borderRadius: 8 }}>
      <Text strong style={{ fontSize: 12 }}>
        Máy chủ giọng AI (tuỳ chọn)
      </Text>
      <Text type="secondary" style={{ fontSize: 11, display: 'block', margin: '2px 0 6px' }}>
        Dán địa chỉ Cloudflare Worker (ví dụ https://audioepub-tts.xxx.workers.dev) để dùng giọng Hoài My / Nam Minh
        trên bản web tĩnh. Để trống nếu dùng server riêng.
      </Text>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          size="small"
          placeholder="https://..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPressEnter={save}
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
        />
        <Button size="small" type="primary" onClick={save} disabled={value.trim() === current}>
          Lưu
        </Button>
      </Space.Compact>
    </div>
  );
};
