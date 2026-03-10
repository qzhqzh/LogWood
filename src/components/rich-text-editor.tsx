'use client'

import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  onTextLengthChange?: (length: number) => void
}

export default function RichTextEditor({
  value,
  onChange,
  onTextLengthChange,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)

  async function uploadImage(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/uploads/article-image', {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()

    if (!res.ok || !data?.url) {
      throw new Error(data?.error || '图片上传失败')
    }

    return data.url as string
  }

  async function insertImage(file: File) {
    if (!editor) return
    if (!file.type.startsWith('image/')) {
      window.alert('仅支持图片文件')
      return
    }

    setUploading(true)
    try {
      const url = await uploadImage(file)
      editor.chain().focus().setImage({ src: url, alt: file.name || 'image' }).run()
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片上传失败'
      window.alert(message)
    } finally {
      setUploading(false)
    }
  }

  function handleChooseFile() {
    fileInputRef.current?.click()
  }

  function handleFiles(files: FileList | null): boolean {
    if (!files || files.length === 0) return false
    void insertImage(files[0])
    return true
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Image],
    content: value || '<p></p>',
    editorProps: {
      attributes: {
        class:
          'min-h-[280px] rounded-b-lg bg-[#12121a] px-3 py-3 text-gray-100 focus:outline-none',
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
    <div className="w-full rounded-lg border border-cyan-500/30 overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.currentTarget.value = ''
        }}
      />
      <div className="flex flex-wrap gap-2 border-b border-cyan-500/20 bg-[#0f0f16] p-2">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className="cyber-button px-2 py-1 rounded text-xs">加粗</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className="cyber-button px-2 py-1 rounded text-xs">斜体</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className="cyber-button px-2 py-1 rounded text-xs">H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className="cyber-button px-2 py-1 rounded text-xs">H3</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className="cyber-button px-2 py-1 rounded text-xs">无序列表</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className="cyber-button px-2 py-1 rounded text-xs">有序列表</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className="cyber-button px-2 py-1 rounded text-xs">引用</button>
        <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className="cyber-button px-2 py-1 rounded text-xs">代码块</button>
        <button type="button" onClick={handleChooseFile} disabled={uploading} className="cyber-button px-2 py-1 rounded text-xs disabled:opacity-60">{uploading ? '上传中...' : '上传图片'}</button>
        <button type="button" onClick={() => editor.chain().focus().undo().run()} className="border border-cyan-500/40 text-cyan-300 px-2 py-1 rounded text-xs hover:bg-cyan-500/10">撤销</button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} className="border border-cyan-500/40 text-cyan-300 px-2 py-1 rounded text-xs hover:bg-cyan-500/10">重做</button>
      </div>
      <EditorContent editor={editor} />
      <div className="px-3 py-2 text-xs text-gray-500 border-t border-cyan-500/15 bg-[#0f0f16]">
        支持工具栏上传、Ctrl/Cmd+V 粘贴图片、拖拽图片到编辑区。
      </div>
    </div>
  )
}
