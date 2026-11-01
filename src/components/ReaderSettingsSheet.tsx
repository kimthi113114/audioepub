import React from 'react';
import { Drawer, Segmented, Slider, Button, Typography } from 'antd';
import { useSettingsStore } from '../store/useSettingsStore';

const { Text } = Typography;

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", "Noto Serif", serif';

interface Props {
  open: boolean;
  onClose: () => void;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: 20 }}>
    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
      {label}
    </Text>
    {children}
  </div>
);

/** "Aa" sheet: theme, scroll/page mode, font size, line height, typeface. */
export const ReaderSettingsSheet: React.FC<Props> = ({ open, onClose }) => {
  const {
    theme, setTheme, readingMode, setReadingMode, fontSize, setFontSize,
    lineHeight, setLineHeight, fontFamily, setFontFamily,
  } = useSettingsStore();

  return (
    <Drawer
      placement="bottom"
      open={open}
      onClose={onClose}
      size="62dvh"
      title="Hiển thị"
      styles={{ body: { padding: '16px 20px', paddingBottom: 'calc(var(--sab, 0px) + 16px)' } }}
    >
      <Row label="Giao diện">
        <Segmented
          block
          size="large"
          value={theme}
          onChange={(v) => setTheme(v as typeof theme)}
          options={[
            { label: 'Sáng', value: 'light' },
            { label: 'Sepia', value: 'sepia' },
            { label: 'Tối', value: 'dark' },
          ]}
        />
      </Row>
      <Row label="Kiểu đọc">
        <Segmented
          block
          size="large"
          value={readingMode}
          onChange={(v) => setReadingMode(v as typeof readingMode)}
          options={[
            { label: 'Cuộn dọc', value: 'continuous' },
            { label: 'Lật trang', value: 'paginated' },
          ]}
        />
      </Row>
      <Row label={`Cỡ chữ: ${fontSize}px`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button aria-label="Giảm cỡ chữ" onClick={() => setFontSize(Math.max(14, fontSize - 2))} style={{ width: 44, height: 44 }}>A-</Button>
          <Slider style={{ flex: 1 }} min={14} max={32} step={2} value={fontSize} onChange={setFontSize} />
          <Button aria-label="Tăng cỡ chữ" onClick={() => setFontSize(Math.min(32, fontSize + 2))} style={{ width: 44, height: 44 }}>A+</Button>
        </div>
      </Row>
      <Row label={`Giãn dòng: ${lineHeight.toFixed(1)}`}>
        <Slider min={1.4} max={2.4} step={0.1} value={lineHeight} onChange={setLineHeight} />
      </Row>
      <Row label="Phông chữ">
        <Segmented
          block
          size="large"
          value={fontFamily === SERIF ? 'serif' : 'sans'}
          onChange={(v) => setFontFamily(v === 'serif' ? SERIF : SANS)}
          options={[
            { label: 'Không chân', value: 'sans' },
            { label: 'Có chân', value: 'serif' },
          ]}
        />
      </Row>
    </Drawer>
  );
};
