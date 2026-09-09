import { describe, expect, it } from 'vitest'
import { normaliseVideoSource, videoSourceIssue } from './video-source'

describe('videoSourceIssue', () => {
  it('bunny sağlayıcısında video kimliği yoksa hata verir', () => {
    expect(videoSourceIssue({ provider: 'bunny', storagePath: 'a/b.mp4' })).toEqual({
      field: 'providerVideoId',
      message: 'Bunny sağlayıcısı için video kimliği zorunludur.',
    })
  })

  it('bunny sağlayıcısında video kimliği varsa sorun yoktur', () => {
    expect(videoSourceIssue({ provider: 'bunny', providerVideoId: 'abc-123' })).toBeNull()
  })

  it('supabase sağlayıcısında storage yolu yoksa hata verir', () => {
    expect(videoSourceIssue({ provider: 'supabase', providerVideoId: 'abc' })?.field).toBe(
      'storagePath',
    )
  })

  it('supabase sağlayıcısında storage yolu varsa sorun yoktur', () => {
    expect(videoSourceIssue({ provider: 'supabase', storagePath: 'konu/video.mp4' })).toBeNull()
  })

  it('yalnızca boşluktan oluşan değeri boş sayar (kısıt geçer ama video oynamaz)', () => {
    expect(videoSourceIssue({ provider: 'bunny', providerVideoId: '   ' })).not.toBeNull()
    expect(videoSourceIssue({ provider: 'supabase', storagePath: '' })).not.toBeNull()
  })
})

describe('normaliseVideoSource', () => {
  it('bunny seçildiğinde storage yolunu düşürür', () => {
    expect(
      normaliseVideoSource({
        provider: 'bunny',
        providerVideoId: ' abc ',
        storagePath: 'eski/yol.mp4',
      }),
    ).toEqual({ provider: 'bunny', provider_video_id: 'abc', storage_path: null })
  })

  it('supabase seçildiğinde sağlayıcı video kimliğini düşürür', () => {
    expect(
      normaliseVideoSource({
        provider: 'supabase',
        providerVideoId: 'eski-kimlik',
        storagePath: ' konu/video.mp4 ',
      }),
    ).toEqual({ provider: 'supabase', provider_video_id: null, storage_path: 'konu/video.mp4' })
  })
})
