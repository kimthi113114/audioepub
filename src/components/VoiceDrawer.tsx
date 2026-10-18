import React, { useState, useMemo } from 'react';
import {
  Drawer,
  Tabs,
  List,
  Button,
  Tag,
  Typography,
  Space,
  Input,
  Alert,
  Card,
  message,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckOutlined,
  CustomerServiceFilled,
  WomanOutlined,
  ManOutlined,
  AppleOutlined,
  WindowsOutlined,
  AndroidOutlined,
  SoundOutlined,
  StarFilled,
  GlobalOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '../store/useSettingsStore';
import { formatVoiceInfo } from '../utils/voiceHelper';
import { EDGE_VOICES, type EdgeVoice } from '../services/edgeTTSService';

const { Text } = Typography;

interface VoiceDrawerProps {
  open: boolean;
  onClose: () => void;
  voices: SpeechSynthesisVoice[];
  vietnameseVoices: SpeechSynthesisVoice[];
  onPreviewVoice: (voiceURI: string, sampleText?: string) => void;
}

export const VoiceDrawer: React.FC<VoiceDrawerProps> = ({
  open,
  onClose,
  voices,
  vietnameseVoices,
  onPreviewVoice,
}) => {
  const {
    selectedVoiceURI,
    setSelectedVoiceURI,
    setTtsEngine,
    setEngineMode,
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<string>('edge');
  const [previewingURI, setPreviewingURI] = useState<string | null>(null);

  // Search filter states
  const [edgeSearch, setEdgeSearch] = useState<string>('');
  const [systemSearch, setSystemSearch] = useState<string>('');

  // Filter Edge Studio Voices
  const filteredEdgeVoices = useMemo(() => {
    if (!edgeSearch.trim()) return EDGE_VOICES;
    const q = edgeSearch.toLowerCase().trim();
    return EDGE_VOICES.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.region.toLowerCase().includes(q) ||
        v.badge.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q)
    );
  }, [edgeSearch]);

  // Filter Web Speech voices
  const filteredSystemVNVoices = useMemo(() => {
    if (!systemSearch.trim()) return vietnameseVoices;
    const q = systemSearch.toLowerCase().trim();
    return vietnameseVoices.filter(
      (v) => v.name.toLowerCase().includes(q) || v.lang.toLowerCase().includes(q)
    );
  }, [vietnameseVoices, systemSearch]);

  const otherVoices = useMemo(() => {
    const list = voices.filter((v) => !vietnameseVoices.includes(v));
    if (!systemSearch.trim()) return list.slice(0, 15);
    const q = systemSearch.toLowerCase().trim();
    return list.filter((v) => v.name.toLowerCase().includes(q) || v.lang.toLowerCase().includes(q)).slice(0, 15);
  }, [voices, vietnameseVoices, systemSearch]);

  // Handle Preview Audio
  const handlePreviewEdgeVoice = (voice: EdgeVoice) => {
    setPreviewingURI(voice.id);
    const sample = voice.lang.startsWith('vi')
      ? `Xin chào! Tôi là ${voice.shortName}, giọng đọc AI Studio tự nhiên 24 kilô héc trên AudioEpub.`
      : `Hello! I am ${voice.shortName}, reading your audiobook with crystal clear studio quality.`;
    onPreviewVoice(voice.id, sample);

    setTimeout(() => {
      setPreviewingURI((current) => (current === voice.id ? null : current));
    }, 4500);
  };

  const handlePreviewSystemVoice = (voice: SpeechSynthesisVoice) => {
    setPreviewingURI(voice.voiceURI);
    const info = formatVoiceInfo(voice);
    const sample = `Xin chào! Tôi là ${info.displayName}, giọng đọc trình duyệt trên AudioEpub.`;
    onPreviewVoice(voice.voiceURI, sample);

    setTimeout(() => {
      setPreviewingURI((current) => (current === voice.voiceURI ? null : current));
    }, 4000);
  };

  // Select Edge Voice
  const handleSelectEdgeVoice = (voice: EdgeVoice) => {
    setSelectedVoiceURI(voice.id);
    setTtsEngine('edge');
    setEngineMode('edge');
    message.success(`Đã chọn: ${voice.name}`);
    onClose();
  };

  // Select System Voice
  const handleSelectSystemVoice = (voice: SpeechSynthesisVoice) => {
    setSelectedVoiceURI(voice.voiceURI);
    setTtsEngine('webspeech');
    setEngineMode('system');
    const info = formatVoiceInfo(voice);
    message.success(`Đã chọn: ${info.displayName}`);
    onClose();
  };

  const renderPlatformIcon = (voiceName: string) => {
    const lower = voiceName.toLowerCase();
    if (lower.includes('apple') || lower.includes('ios') || lower.includes('linh') || lower.includes('an')) {
      return <AppleOutlined style={{ color: '#000000', fontSize: 16 }} />;
    }
    if (lower.includes('microsoft') || lower.includes('windows') || lower.includes('natural')) {
      return <WindowsOutlined style={{ color: '#0078d4', fontSize: 16 }} />;
    }
    if (lower.includes('google') || lower.includes('android')) {
      return <AndroidOutlined style={{ color: '#34a853', fontSize: 16 }} />;
    }
    return <SoundOutlined style={{ color: '#64748b', fontSize: 16 }} />;
  };

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Space align="center" size={8}>
            <CustomerServiceFilled style={{ color: '#1677ff', fontSize: 18 }} />
            <span style={{ fontWeight: 600, fontSize: 16 }}>Chọn Giọng Đọc Sách</span>
          </Space>
          <Tag color="cyan" style={{ borderRadius: 10, fontSize: 11, margin: 0, fontWeight: 600 }}>
            24kHz Studio HD
          </Tag>
        </div>
      }
      placement="bottom"
      onClose={onClose}
      open={open}
      height="80vh"
      styles={{
        body: { padding: '12px 14px', paddingBottom: 'calc(var(--sab, 0px) + 24px)' },
        header: { padding: '12px 16px' },
      }}
      destroyOnClose
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="small"
        items={[
          {
            key: 'edge',
            label: (
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                🌟 Giọng Studio (Khuyên dùng)
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Intro Card */}
                <Card
                  size="small"
                  style={{
                    background: 'linear-gradient(135deg, #f0f7ff 0%, #f9f0ff 100%)',
                    borderColor: '#adc6ff',
                    borderRadius: 10,
                  }}
                >
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <StarFilled style={{ color: '#faad14', fontSize: 14 }} />
                      <span style={{ fontWeight: 600, color: '#1d39c4', fontSize: 13 }}>
                        Microsoft Studio Neural (24kHz HD)
                      </span>
                      <Tag color="green" style={{ borderRadius: 8, fontSize: 10, padding: '0 4px', margin: 0 }}>
                        0MB Free
                      </Tag>
                    </div>
                    <Text style={{ fontSize: 11, color: '#475569', lineHeight: 1.3 }}>
                      Chất lượng cao nhất: Đọc truyền cảm, ngắt nghỉ đúng ngữ điệu dấu câu tiếng Việt, hỗ trợ chạy ngầm mượt mà khi khóa màn hình iOS/Android.
                    </Text>
                  </Space>
                </Card>

                {/* Search */}
                <Input.Search
                  placeholder="Tìm giọng (Hoài My, Nam Minh, Jenny...)"
                  allowClear
                  value={edgeSearch}
                  onChange={(e) => setEdgeSearch(e.target.value)}
                  style={{ borderRadius: 8 }}
                />

                {/* Voice List */}
                <List
                  dataSource={filteredEdgeVoices}
                  renderItem={(voice) => {
                    const isSelected = selectedVoiceURI === voice.id;
                    const isPreviewing = previewingURI === voice.id;

                    return (
                      <List.Item
                        key={voice.id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          marginBottom: 8,
                          background: isSelected ? '#e6f4ff' : '#f8fafc',
                          border: isSelected ? '1.5px solid #1677ff' : '1px solid #f1f5f9',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            gap: 8,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: '50%',
                                background: voice.gender === 'female' ? '#fff0f6' : '#e6f4ff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                border: `1.5px solid ${voice.gender === 'female' ? '#ffadd2' : '#91caff'}`,
                              }}
                            >
                              {voice.gender === 'female' ? (
                                <WomanOutlined style={{ color: '#eb2f96', fontSize: 18 }} />
                              ) : (
                                <ManOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                              )}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                                  {voice.name}
                                </span>
                                {voice.isRecommended && (
                                  <Tag color="gold" style={{ borderRadius: 6, fontSize: 10, padding: '0 4px', margin: 0 }}>
                                    Khuyên dùng
                                  </Tag>
                                )}
                                <Tag color={voice.color} style={{ borderRadius: 6, fontSize: 10, padding: '0 4px', margin: 0 }}>
                                  {voice.badge}
                                </Tag>
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: '#64748b',
                                  marginTop: 2,
                                  lineHeight: 1.3,
                                }}
                              >
                                {voice.description}
                              </div>
                            </div>
                          </div>

                          <Space size={6} style={{ flexShrink: 0 }}>
                            <Button
                              size="small"
                              icon={isPreviewing ? <LoadingOutlined /> : <PlayCircleOutlined />}
                              onClick={() => handlePreviewEdgeVoice(voice)}
                              loading={isPreviewing}
                              style={{ borderRadius: 6, height: 32 }}
                            >
                              Thử
                            </Button>
                            <Button
                              type={isSelected ? 'primary' : 'default'}
                              size="small"
                              icon={isSelected ? <CheckOutlined /> : undefined}
                              onClick={() => handleSelectEdgeVoice(voice)}
                              style={{ borderRadius: 6, fontWeight: 600, height: 32, minWidth: 70 }}
                            >
                              {isSelected ? 'Đang chọn' : 'Chọn'}
                            </Button>
                          </Space>
                        </div>
                      </List.Item>
                    );
                  }}
                />
              </div>
            ),
          },
          {
            key: 'system',
            label: (
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                📱 Giọng Máy (Web Speech)
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Alert
                  type="info"
                  showIcon
                  message="Dự phòng Ngoại tuyến"
                  description="Sử dụng giọng đọc tích hợp sẵn trên thiết bị khi không có mạng internet."
                  style={{ borderRadius: 8, fontSize: 12 }}
                />

                <Input.Search
                  placeholder="Tìm giọng trình duyệt..."
                  allowClear
                  value={systemSearch}
                  onChange={(e) => setSystemSearch(e.target.value)}
                  style={{ borderRadius: 8 }}
                />

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    🇻🇳 Giọng Tiếng Việt Trên Máy ({filteredSystemVNVoices.length})
                  </div>

                  {filteredSystemVNVoices.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '12px', color: '#94a3b8', fontSize: 12 }}>
                      Không tìm thấy giọng tiếng Việt trong hệ thống
                    </div>
                  ) : (
                    <List
                      dataSource={filteredSystemVNVoices}
                      renderItem={(voice) => {
                        const isSelected = selectedVoiceURI === voice.voiceURI;
                        const isPreviewing = previewingURI === voice.voiceURI;
                        const info = formatVoiceInfo(voice);

                        return (
                          <List.Item
                            key={voice.voiceURI}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 8,
                              marginBottom: 6,
                              background: isSelected ? '#e6f4ff' : '#f8fafc',
                              border: isSelected ? '1.5px solid #1677ff' : '1px solid #f1f5f9',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                gap: 6,
                              }}
                            >
                              <Space align="center" size={8} style={{ flex: 1, minWidth: 0 }}>
                                {renderPlatformIcon(voice.name)}
                                <div style={{ overflow: 'hidden' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                                      {info.displayName}
                                    </span>
                                    <Tag color={info.color} style={{ borderRadius: 4, fontSize: 10, padding: '0 4px' }}>
                                      {info.badge}
                                    </Tag>
                                  </div>
                                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{voice.name}</div>
                                </div>
                              </Space>

                              <Space size={4} style={{ flexShrink: 0 }}>
                                <Button
                                  size="small"
                                  icon={isPreviewing ? <LoadingOutlined /> : <PlayCircleOutlined />}
                                  onClick={() => handlePreviewSystemVoice(voice)}
                                  loading={isPreviewing}
                                >
                                  Thử
                                </Button>
                                <Button
                                  type={isSelected ? 'primary' : 'default'}
                                  size="small"
                                  onClick={() => handleSelectSystemVoice(voice)}
                                  style={{ fontWeight: 500 }}
                                >
                                  {isSelected ? 'Đang chọn' : 'Chọn'}
                                </Button>
                              </Space>
                            </div>
                          </List.Item>
                        );
                      }}
                    />
                  )}
                </div>

                {otherVoices.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6, marginTop: 6 }}>
                      <GlobalOutlined /> Giọng Đọc Quốc Tế ({otherVoices.length})
                    </div>
                    <List
                      dataSource={otherVoices}
                      renderItem={(voice) => {
                        const isSelected = selectedVoiceURI === voice.voiceURI;
                        const isPreviewing = previewingURI === voice.voiceURI;

                        return (
                          <List.Item
                            key={voice.voiceURI}
                            style={{
                              padding: '6px 8px',
                              borderRadius: 6,
                              marginBottom: 4,
                              background: isSelected ? '#e6f4ff' : '#ffffff',
                              border: '1px solid #f1f5f9',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 500, fontSize: 12 }}>{voice.name}</span>
                                <Tag style={{ marginLeft: 4, fontSize: 9 }}>{voice.lang}</Tag>
                              </div>
                              <Space size={4}>
                                <Button
                                  size="small"
                                  onClick={() => handlePreviewSystemVoice(voice)}
                                  loading={isPreviewing}
                                >
                                  Thử
                                </Button>
                                <Button
                                  type={isSelected ? 'primary' : 'default'}
                                  size="small"
                                  onClick={() => handleSelectSystemVoice(voice)}
                                >
                                  {isSelected ? 'Đang chọn' : 'Chọn'}
                                </Button>
                              </Space>
                            </div>
                          </List.Item>
                        );
                      }}
                    />
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
    </Drawer>
  );
};
