'use client';

import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Youtube from '@tiptap/extension-youtube';
import Link from '@tiptap/extension-link';
import { Bold, Italic, List, ListOrdered, Quote, Undo, Redo, Youtube as YoutubeIcon, Link as LinkIcon, Unlink } from 'lucide-react';

interface EditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const TiptapEditor = ({ value, onChange }: EditorProps) => {
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Youtube.configure({
        width: 480,
        height: 320,
      }) as any,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-stone max-w-none focus:outline-none min-h-[200px] p-4',
      },
    },
  }, [isClient]); // Přidání isClient jako závislosti pro inicializaci pouze na klientovi

  // Update editor content when prop changes (e.g. when editing a different post)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!isClient || !editor) return null;

  const addYoutubeVideo = () => {
    const url = prompt('Vložte URL YouTube videa:');
    if (url) {
      editor.commands.setYoutubeVideo({
        src: url,
      });
    }
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL odkazu:', previousUrl);
    
    // Zrušení odkazu pokud se vloží prázdné nebo storno
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    
    // Update/Set odkaz
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="border rounded-xl overflow-hidden bg-stone-50 focus-within:border-green-600 transition-colors">
      <div className="flex flex-wrap gap-1 p-2 border-b bg-white">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-stone-100 ${editor.isActive('bold') ? 'text-green-600 bg-green-50' : 'text-stone-500'}`}
        >
          <Bold size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-stone-100 ${editor.isActive('italic') ? 'text-green-600 bg-green-50' : 'text-stone-500'}`}
        >
          <Italic size={18} />
        </button>
        <div className="w-px h-6 bg-stone-200 mx-1 self-center" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-stone-100 ${editor.isActive('bulletList') ? 'text-green-600 bg-green-50' : 'text-stone-500'}`}
        >
          <List size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-stone-100 ${editor.isActive('orderedList') ? 'text-green-600 bg-green-50' : 'text-stone-500'}`}
        >
          <ListOrdered size={18} />
        </button>
        <div className="w-px h-6 bg-stone-200 mx-1 self-center" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded hover:bg-stone-100 ${editor.isActive('blockquote') ? 'text-green-600 bg-green-50' : 'text-stone-500'}`}
        >
          <Quote size={18} />
        </button>
        <div className="w-px h-6 bg-stone-200 mx-1 self-center" />
        <button
          type="button"
          onClick={setLink}
          className={`p-2 rounded hover:bg-stone-100 ${editor.isActive('link') ? 'text-blue-600 bg-blue-50' : 'text-stone-500'}`}
          title="Vložit odkaz"
        >
          <LinkIcon size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetLink().run()}
          disabled={!editor.isActive('link')}
          className="p-2 rounded hover:bg-stone-100 text-stone-500 disabled:opacity-30"
          title="Zrušit odkaz"
        >
          <Unlink size={18} />
        </button>
        <div className="w-px h-6 bg-stone-200 mx-1 self-center" />
        <button
          type="button"
          onClick={addYoutubeVideo}
          className="p-2 rounded hover:bg-stone-100 text-stone-500"
        >
          <YoutubeIcon size={18} />
        </button>
        <div className="flex-grow" />
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          className="p-2 rounded hover:bg-stone-100 text-stone-500"
        >
          <Undo size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          className="p-2 rounded hover:bg-stone-100 text-stone-500"
        >
          <Redo size={18} />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};

const Editor = (props: EditorProps) => {
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-[200px] w-full bg-stone-50 animate-pulse rounded-xl border border-dashed border-stone-200" />;
  }

  return <TiptapEditor {...props} />;
};

export default Editor;
