'use client'

import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { Node, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import Image from '@tiptap/extension-image'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  onTextLengthChange?: (length: number) => void
}

const MAX_VIDEO_SIZE_BYTES = 30 * 1024 * 1024

const FONT_OPTIONS = [
  { value: '', label: '默认字体' },
  { value: "'Rajdhani', 'Segoe UI', sans-serif", label: 'Rajdhani' },
  { value: "'Orbitron', 'Segoe UI', sans-serif", label: 'Orbitron' },
  { value: "'Noto Sans SC', 'Segoe UI', sans-serif", label: 'Noto Sans SC' },
  { value: "'Source Han Sans SC', 'Segoe UI', sans-serif", label: '思源黑体' },
]

const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      controls: {
        default: true,
      },
      preload: {
        default: 'metadata',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'video[src]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes({ class: 'article-video' }, HTMLAttributes)]
  },
})

function toolbarButtonClass(active = false): string {
  return active
    ? 'px-2 py-1 rounded text-xs border border-cyan-300/70 bg-cyan-500/20 text-cyan-100'
    : 'px-2 py-1 rounded text-xs border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10'
}

async function safeReadJson<T>(res: Response): Promise<T | null> {
  const text = await res.text()
  if (!text) return null

  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export default function RichTextEditor({
  value,
  onChange,
  onTextLengthChange,
}: RichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)

  async function uploadImage(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/uploads/article-image', {
      method: 'POST',
      body: formData,
    })
    const data = await safeReadJson<{ url?: string; error?: string }>(res)

    if (!res.ok || !data?.url) {
      throw new Error(data?.error || '图片上传失败')
    }

    return data.url as string
  }

  async function uploadVideo(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/uploads/article-video', {
      method: 'POST',
      body: formData,
    })
    const data = await safeReadJson<{ url?: string; error?: string }>(res)

    if (!res.ok || !data?.url) {
      if (res.status === 502 || res.status === 504) {
        throw new Error('视频上传超时（网关超时），请压缩后重试，建议控制在 30MB 内')
      }
      throw new Error(data?.error || '视频上传失败')
    }

    return data.url as string
  }

  async function insertImage(file: File) {
    if (!editor) return
    if (!file.type.startsWith('image/')) {
      window.alert('仅支持图片文件')
      return
    }

    setUploadingImage(true)
    try {
      const url = await uploadImage(file)
      editor.chain().focus().setImage({ src: url, alt: file.name || 'image' }).run()
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片上传失败'
      window.alert(message)
    } finally {
      setUploadingImage(false)
    }
  }

  async function insertVideo(file: File) {
    if (!editor) return
    if (!file.type.startsWith('video/')) {
      window.alert('仅支持视频文件')
      return
    }

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      window.alert('视频建议控制在 30MB 内，避免上传超时（502）')
      return
    }

    setUploadingVideo(true)
    try {
      const url = await uploadVideo(file)
      editor.chain().focus().insertContent({
        type: 'video',
        attrs: {
          src: url,
          controls: true,
          preload: 'metadata',
        },
      }).run()
      editor.chain().focus().insertContent('<p></p>').run()
    } catch (error) {
      const message = error instanceof Error ? error.message : '视频上传失败'
      window.alert(message)
    } finally {
      setUploadingVideo(false)
    }
  }

  function handleChooseImage() {
    imageInputRef.current?.click()
  }

  function handleChooseVideo() {
    videoInputRef.current?.click()
  }

  function handleFiles(files: FileList | null): boolean {
    if (!files || files.length === 0) return false
    const file = files[0]
    if (file.type.startsWith('image/')) {
      void insertImage(file)
      return true
    }
    if (file.type.startsWith('video/')) {
      void insertVideo(file)
      return true
    }
    window.alert('仅支持图片或视频文件')
    return true
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      TextStyle,
      FontFamily,
      Image,
      Video,
    ],
    content: value || '<p></p>',
    editorProps: {
      attributes: {
        class:
          'min-h-[280px] rounded-b-lg bg-[#12121a] px-3 py-3 text-gray-100 focus:outline-none tiptap-editor-content',
      },
      handleDrop: (_view, event) => {
        const dragEvent = event as DragEvent
        return handleFiles(dragEvent.dataTransfer?.files || null)
      },
      handlePaste: (_view, event) => {
        return handleFiles(event.clipboardData?.files || null)
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML()
      onChange(html)
      onTextLengthChange?.(currentEditor.getText().trim().length)
    },
  })

  useEffect(() => {
    if (!editor) return
    if (value === editor.getHTML()) return
    editor.commands.setContent(value || '<p></p>', { emitUpdate: false })
  }, [editor, value])

  if (!editor) {
    return <div className="w-full min-h-[280px] rounded-lg border border-cyan-500/30 bg-[#12121a]" />
  }

  return (
    <div className="w-full rounded-lg border border-cyan-500/30 overflow-hidden tiptap-editor">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.currentTarget.value = ''
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.currentTarget.value = ''
        }}
      />
      <div className="flex flex-wrap gap-2 border-b border-cyan-500/20 bg-[#0f0f16] p-2">
        <select
          className="px-2 py-1 rounded text-xs border border-cyan-500/40 bg-[#111623] text-cyan-200"
          value={editor.getAttributes('textStyle').fontFamily || ''}
          onChange={(e) => {
            const next = e.target.value
            if (!next) {
              editor.chain().focus().unsetFontFamily().run()
              return
            }
            editor.chain().focus().setFontFamily(next).run()
          }}
        >
          {FONT_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>{option.label}</option>
          ))}
        </select>
        <button type="button" onClick={() => editor.chain().focus().setParagraph().run()} className={toolbarButtonClass(editor.isActive('paragraph'))}>正文</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={toolbarButtonClass(editor.isActive('heading', { level: 1 }))}>H1</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={toolbarButtonClass(editor.isActive('heading', { level: 2 }))}>H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={toolbarButtonClass(editor.isActive('heading', { level: 3 }))}>H3</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={toolbarButtonClass(editor.isActive('bold'))}>加粗</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={toolbarButtonClass(editor.isActive('italic'))}>斜体</button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={toolbarButtonClass(editor.isActive('strike'))}>删除线</button>
        <button type="button" onClick={() => editor.chain().focus().toggleCode().run()} className={toolbarButtonClass(editor.isActive('code'))}>行内代码</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={toolbarButtonClass(editor.isActive('bulletList'))}>无序列表</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={toolbarButtonClass(editor.isActive('orderedList'))}>有序列表</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={toolbarButtonClass(editor.isActive('blockquote'))}>引用</button>
        <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={toolbarButtonClass(editor.isActive('codeBlock'))}>代码块</button>
        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={toolbarButtonClass(false)}>分割线</button>
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className={toolbarButtonClass(false)}
        >
          清除格式
        </button>
        <button type="button" onClick={handleChooseImage} disabled={uploadingImage} className="cyber-button px-2 py-1 rounded text-xs disabled:opacity-60">{uploadingImage ? '上传中...' : '上传图片'}</button>
        <button type="button" onClick={handleChooseVideo} disabled={uploadingVideo} className="cyber-button px-2 py-1 rounded text-xs disabled:opacity-60">{uploadingVideo ? '上传中...' : '上传视频'}</button>
        <button type="button" onClick={() => editor.chain().focus().undo().run()} className="border border-cyan-500/40 text-cyan-300 px-2 py-1 rounded text-xs hover:bg-cyan-500/10">撤销</button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} className="border border-cyan-500/40 text-cyan-300 px-2 py-1 rounded text-xs hover:bg-cyan-500/10">重做</button>
      </div>
      <EditorContent editor={editor} />
      <div className="px-3 py-2 text-xs text-gray-500 border-t border-cyan-500/15 bg-[#0f0f16]">
        支持 H1/H2/H3、字体选择、列表、引用、代码块、分割线、上传图片/视频、Ctrl/Cmd+V 粘贴媒体、拖拽媒体到编辑区。
      </div>
    </div>
  )
}
