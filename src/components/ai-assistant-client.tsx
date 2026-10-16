'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Bot, User, Sparkles, Send, Loader2, Plus, Search, Trash2, MessageSquare, Clock, X, Settings, MoreVertical, Share2, Pin, Pencil, Book, ChevronDown, Check, Volume2, Square, Terminal, BrainCircuit, Mic2, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
};

type Conversation = {
    id: string;
    title: string;
    messages: Message[];
    createdAt: number;
};

type AIConfig = {
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    language: string;
    autoSpeak: boolean;
    voiceURI: string;
};

const STORAGE_KEY = 'ai-assistant-conversations';
const CONFIG_KEY = 'ai-assistant-config';

const DEFAULT_CONFIG: AIConfig = {
    model: 'google:gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: '', // Vacío por defecto para que use ai-prompt.ts del servidor
    language: 'es',
    autoSpeak: false,
    voiceURI: '',
};

const AI_MODELS = [
    { label: 'Google (Gemini)', options: [
        { value: 'google:gemini-2.5-flash', name: '2.5 Flash', desc: 'Respuestas rápidas', icon: '⚡' },
    ]},
    { label: 'Groq (Rápido)', options: [
        { value: 'groq:llama-3.3-70b-versatile', name: 'Llama 3.3 70B', desc: 'Rápido y potente', icon: '🦙' },
    ]}
];

function loadConversations(): Conversation[] {
    try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveConversations(convs: Conversation[]) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(convs)); } catch {}
}
function loadConfig(): AIConfig {
    try { const raw = localStorage.getItem(CONFIG_KEY); return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG; } catch { return DEFAULT_CONFIG; }
}
function saveConfig(cfg: AIConfig) {
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); } catch {}
}

export default function AiAssistantClient() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [configOpen, setConfigOpen] = useState(false);
    const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
    const [speakingId, setSpeakingId] = useState<string | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setConversations(loadConversations());
        setConfig(loadConfig());
        
        // Load voices
        if ('speechSynthesis' in window) {
            const loadVoices = () => {
                const voices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('es'));
                setAvailableVoices(voices);
            };
            loadVoices();
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const updateConfig = (patch: Partial<AIConfig>) => {
        setConfig(prev => {
            const updated = { ...prev, ...patch };
            saveConfig(updated);
            return updated;
        });
    };

    const speak = useCallback((id: string, text: string) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            
            // Limpiar Markdown y símbolos para que la voz sea más natural
            const cleanText = text
                .replace(/```[\s\S]*?```/g, '') // Eliminar bloques de código
                .replace(/`[^`]*`/g, '') // Eliminar código en línea
                .replace(/(\*\*|\*|__|_)/g, '') // Eliminar asteriscos y guiones bajos (negrita/cursiva)
                .replace(/#+\s/g, '') // Eliminar encabezados #
                .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Extraer texto de enlaces
                .replace(/^[\s-]*[-*]\s+/gm, '') // Eliminar guiones de listas
                .replace(/^\s*>\s+/gm, '') // Eliminar blockquotes
                .replace(/[/\\|~]/g, ' ') // Reemplazar barras y otros símbolos con espacios
                .replace(/(\d),(\d)/g, '$1$2') // Quitar comas de los números (ej. 1,000 -> 1000)
                .replace(/\bqq\b/gi, ' quintales') // Expandir qq
                .replace(/\bkg\b/gi, ' kilogramos') // Expandir kg
                .trim();

            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = config.language === 'es' ? 'es-ES' : 'en-US';
            
            const setVoiceAndSpeak = () => {
                const voices = window.speechSynthesis.getVoices();
                if (voices.length > 0) {
                    let selectedVoice: SpeechSynthesisVoice | undefined;
                    if (config.voiceURI) {
                        selectedVoice = voices.find(v => v.voiceURI === config.voiceURI);
                    }
                    if (!selectedVoice) {
                        const isSpanish = (v: SpeechSynthesisVoice) => v.lang.startsWith('es');
                        const spanishVoices = voices.filter(isSpanish);
                        selectedVoice = spanishVoices.find(v => v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('online')) 
                                     || spanishVoices.find(v => v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('microsoft'))
                                     || spanishVoices[0] 
                                     || voices[0];
                    }
                    if (selectedVoice) {
                        utterance.voice = selectedVoice;
                    }
                }
                
                utterance.onend = () => setSpeakingId(null);
                utterance.onerror = () => setSpeakingId(null);
                setSpeakingId(id);
                window.speechSynthesis.speak(utterance);
            };

            if (window.speechSynthesis.getVoices().length > 0) {
                setVoiceAndSpeak();
            } else {
                const handleVoicesChanged = () => {
                    setVoiceAndSpeak();
                    window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
                };
                window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
            }
        }
    }, [config.language, config.voiceURI]);

    const stopSpeaking = useCallback(() => {
        if ('speechSynthesis' in window) { 
            window.speechSynthesis.cancel();
            setSpeakingId(null);
        }
    }, []);

    const startNewConversation = useCallback(() => {
        setActiveId(null);
        setMessages([]);
        setInputValue('');
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const loadConversation = useCallback((conv: Conversation) => {
        setActiveId(conv.id);
        setMessages(conv.messages);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, []);

    const deleteConversation = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setConversations(prev => {
            const updated = prev.filter(c => c.id !== id);
            saveConversations(updated);
            return updated;
        });
        if (activeId === id) startNewConversation();
    }, [activeId, startNewConversation]);

    const submitChat = useCallback(async (textToSubmit: string, contextMessages: Message[]) => {
        if (!textToSubmit.trim() || isLoading) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: textToSubmit.trim() };
        const assistantId = (Date.now() + 1).toString();
        const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '' };

        const newMessages = [...contextMessages, userMsg, assistantMsg];
        setMessages(newMessages);
        setIsLoading(true);
        setEditingMessageId(null);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...contextMessages, userMsg].map(m => ({ role: m.role, content: m.content })),
                    config,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || 'Error de conexión.');
            }
            if (!response.body) throw new Error('Cuerpo de respuesta vacío.');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                accumulated += decoder.decode(value, { stream: true });
                setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m));
            }

            const finalContent = accumulated || '⚠️ **Error de Cuota o Conexión:** La IA no pudo responder. Es posible que hayas excedido el límite gratuito temporal (Rate Limit). Por favor, **espera 1 minuto** o selecciona otro modelo en la Configuración e inténtalo de nuevo.';
            const finalMessages = newMessages.map(m => m.id === assistantId ? { ...m, content: finalContent } : m);
            const title = contextMessages.length === 0 ? (textToSubmit.length > 50 ? textToSubmit.slice(0, 50) + '…' : textToSubmit) : undefined;

            setConversations(prev => {
                let updated: Conversation[];
                if (activeId) {
                    updated = prev.map(c => c.id === activeId ? { ...c, messages: finalMessages, ...(title ? {title} : {}) } : c);
                } else {
                    const newConv: Conversation = { id: Date.now().toString(), title: title || 'Nueva conversación', messages: finalMessages, createdAt: Date.now() };
                    setActiveId(newConv.id);
                    updated = [newConv, ...prev];
                }
                saveConversations(updated);
                return updated;
            });

            // Auto-speak si está habilitado
            if (config.autoSpeak && accumulated) {
                speak(assistantId, accumulated);
            }

        } catch (error: any) {
            setMessages(prev => prev.map(m => m.id === assistantId
                ? { ...m, content: `⚠️ **Error:** ${error.message || 'Verifica que la API Key esté configurada y no hayas excedido tu límite de cuota (Rate Limit).'}` }
                : m
            ));
        } finally {
            setIsLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isLoading, activeId, config]);

    const sendMessage = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        const text = inputValue.trim();
        setInputValue('');
        submitChat(text, messages);
    }, [inputValue, messages, submitChat]);

    const handleEditSubmit = useCallback((id: string, newContent: string) => {
        const index = messages.findIndex(m => m.id === id);
        if (index === -1) return;
        const context = messages.slice(0, index);
        submitChat(newContent, context);
    }, [messages, submitChat]);

    const filteredConversations = conversations.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isChatting = messages.length > 0;

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">

            {/* Left Sidebar */}
            <aside className={cn(
                "shrink-0 flex flex-col border-r border-border bg-card/30 overflow-hidden transition-all duration-300 ease-in-out",
                sidebarOpen ? "w-72" : "w-0 border-r-0"
            )}>
                <div className="flex flex-col h-full w-full">
                    {/* Sidebar Header */}
                    <div className="p-4 border-b border-border flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary shrink-0" />
                        <span className="font-semibold text-sm">Asistente IA</span>
                    </div>

                    {/* Actions */}
                    <div className="p-3 space-y-1">
                        <button onClick={startNewConversation} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
                            <Plus className="h-4 w-4 shrink-0" />
                            Nueva conversación
                        </button>
                        <button onClick={() => setShowSearch(s => !s)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
                            <Search className="h-4 w-4 shrink-0" />
                            Buscar conversaciones
                        </button>
                    </div>

                    {/* Search Input */}
                    {showSearch && (
                        <div className="px-3 pb-2">
                            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <input type="text" className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground" placeholder="Buscar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
                                {searchQuery && <button onClick={() => setSearchQuery('')}><X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>}
                            </div>
                        </div>
                    )}

                    {/* Recents */}
                    <div className="flex-1 overflow-y-auto px-3 pb-2 flex flex-col">
                        <div className="flex items-center gap-2 px-1 py-2 mb-1">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recientes</span>
                        </div>
                        {filteredConversations.length > 0 ? (
                            <div className="space-y-0.5">
                                {filteredConversations.map(conv => (
                                    <div key={conv.id} onClick={() => loadConversation(conv)} className={cn(
                                        "relative w-full group flex items-center gap-2 px-3 py-2.5 pr-10 rounded-xl text-sm text-left transition-colors cursor-pointer",
                                        activeId === conv.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                    )}>
                                        <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60 mt-0.5" />
                                        <span className="flex-1 min-w-0 line-clamp-2 text-xs leading-relaxed break-words">{conv.title}</span>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-all flex items-center justify-center text-muted-foreground outline-none">
                                                    <MoreVertical className="h-4 w-4" />
                                                </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56 font-sans">
                                                <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="gap-2 cursor-pointer text-sm">
                                                    <Share2 className="h-4 w-4 text-muted-foreground" />
                                                    <span>Compartir conversación</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="gap-2 cursor-pointer text-sm">
                                                    <Pin className="h-4 w-4 text-muted-foreground" />
                                                    <span>Fijar</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="gap-2 cursor-pointer text-sm">
                                                    <Pencil className="h-4 w-4 text-muted-foreground" />
                                                    <span>Cambiar nombre</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="gap-2 cursor-pointer text-sm">
                                                    <Book className="h-4 w-4 text-muted-foreground" />
                                                    <span>Añadir al cuaderno</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem 
                                                    onSelect={(e) => {
                                                        deleteConversation(conv.id, e as any);
                                                    }} 
                                                    className="gap-2 cursor-pointer text-sm text-destructive focus:bg-destructive/10 focus:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    <span>Eliminar</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center m-auto text-center opacity-70">
                                <MessageSquare className="h-6 w-6 text-muted-foreground/50 mb-2" />
                                <p className="text-[13px] text-muted-foreground leading-snug">Tus conversaciones<br/>aparecerán aquí</p>
                            </div>
                        )}
                    </div>

                    {/* Config Button at bottom */}
                    <div className="border-t border-border p-3">
                        <button
                            onClick={() => setConfigOpen(true)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                        >
                            <Settings className="h-4 w-4 shrink-0" />
                            Configuración IA
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Chat Area */}
            <div className="flex flex-col flex-1 overflow-hidden">

                {/* Top bar */}
                <div className="shrink-0 px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(o => !o)} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground" title={sidebarOpen ? 'Cerrar barra lateral' : 'Abrir barra lateral'}>
                        {sidebarOpen ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 9-3 3 3 3"/></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m10 15 3-3-3-3"/></svg>
                        )}
                    </Button>
                    <span className="text-sm font-medium text-muted-foreground flex-1 truncate">
                        {activeId ? conversations.find(c => c.id === activeId)?.title ?? 'Conversación' : 'Nueva conversación'}
                    </span>
                    <span className="text-xs text-muted-foreground/60 bg-muted rounded-full px-2 py-0.5">{config.model}</span>
                </div>

                {/* Messages area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    {!isChatting ? (
                        <div className="h-full flex flex-col items-center justify-center">
                            <h2 className="text-3xl md:text-4xl font-normal bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent text-center">
                                Hola, empecemos
                            </h2>
                            <p className="text-muted-foreground mt-4 text-sm text-center">
                                Pregúntame sobre tus datos de producción, paradas o materiales.
                            </p>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-6">
                            {messages.map(m => (
                                <div key={m.id} className={`flex gap-3 group ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {m.role !== 'user' && (
                                        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                                            <Bot className="h-4 w-4 text-primary" />
                                        </div>
                                    )}
                                    {m.role === 'user' && editingMessageId !== m.id && (
                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setEditingMessageId(m.id)} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground" title="Editar mensaje">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    )}
                                    <div className={`px-4 py-3 rounded-2xl max-w-[80%] text-sm leading-relaxed ${m.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm shadow-md' : 'bg-muted/50 border border-border text-foreground rounded-bl-sm'}`}>
                                        {m.role === 'user' && editingMessageId === m.id ? (
                                            <div className="flex flex-col gap-2 min-w-[200px]">
                                                <textarea 
                                                    autoFocus
                                                    className="w-full bg-primary-foreground/10 text-primary-foreground text-sm rounded-md border border-primary-foreground/30 p-2 focus:outline-none focus:ring-1 focus:ring-primary-foreground/60 resize-none min-h-[60px] placeholder:text-primary-foreground/50"
                                                    defaultValue={m.content}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            handleEditSubmit(m.id, e.currentTarget.value);
                                                        } else if (e.key === 'Escape') {
                                                            setEditingMessageId(null);
                                                        }
                                                    }}
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" variant="ghost" className="h-6 text-[10px] text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => setEditingMessageId(null)}>Cancelar</Button>
                                                    <Button size="sm" className="h-6 text-[10px] bg-primary-foreground text-primary hover:bg-primary-foreground/90" onClick={(e) => {
                                                        const ta = e.currentTarget.parentElement?.previousElementSibling as HTMLTextAreaElement;
                                                        if(ta) handleEditSubmit(m.id, ta.value);
                                                    }}>Guardar y reenviar</Button>
                                                </div>
                                            </div>
                                        ) : m.content ? (
                                            <div className="break-words">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1 my-2" {...props} />,
                                                        ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1 my-2" {...props} />,
                                                        li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
                                                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                                                        strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                                                        a: ({ node, ...props }) => <a className="text-primary hover:underline" {...props} />,
                                                    }}
                                                >
                                                    {m.content}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            <span className="flex items-center gap-2 text-muted-foreground">
                                                <Loader2 className="h-3 w-3 animate-spin" /> Analizando...
                                            </span>
                                        )}
                                        {m.role !== 'user' && m.content && (
                                            <div className="flex justify-end mt-3 border-t border-border/50 pt-2">
                                                {speakingId === m.id ? (
                                                    <button onClick={stopSpeaking} className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 text-xs font-medium">
                                                        <Square className="h-3.5 w-3.5 fill-current" /> Silenciar
                                                    </button>
                                                ) : (
                                                    <button onClick={() => speak(m.id, m.content)} className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 text-xs font-medium">
                                                        <Volume2 className="h-3.5 w-3.5" /> Escuchar
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {m.role === 'user' && (
                                        <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0 mt-1">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div ref={bottomRef} />
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="shrink-0 p-4 border-t border-border bg-card/30 backdrop-blur-sm">
                    <div className="max-w-3xl mx-auto relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/40 to-indigo-500/40 rounded-full blur opacity-0 group-hover:opacity-30 transition duration-500 pointer-events-none" />
                        <form onSubmit={sendMessage} className="relative flex items-center bg-card border border-border rounded-full px-4 py-1 shadow-lg focus-within:border-primary/60 transition-colors">
                            <Sparkles className="h-4 w-4 text-muted-foreground ml-1 mr-3 shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none py-3 text-sm"
                                value={inputValue}
                                placeholder="Pregunta sobre tu producción, paradas, materiales..."
                                onChange={(e) => setInputValue(e.target.value)}
                                disabled={isLoading}
                                autoComplete="off"
                                autoFocus
                            />
                            
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 mr-1 rounded-full hover:bg-muted text-sm font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0 outline-none">
                                        {AI_MODELS.flatMap(g => g.options).find(o => o.value === config.model)?.name || 'Modelo'}
                                        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 font-sans">
                                    {AI_MODELS.map((group, groupIdx) => (
                                        <React.Fragment key={group.label}>
                                            {groupIdx > 0 && <DropdownMenuSeparator />}
                                            <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                {group.label}
                                            </div>
                                            {group.options.map(option => (
                                                <DropdownMenuItem 
                                                    key={option.value} 
                                                    onClick={() => updateConfig({ model: option.value })}
                                                    className="flex items-start gap-2 py-2 cursor-pointer relative pr-8"
                                                >
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-sm font-medium">{option.name}</span>
                                                        <span className="text-xs text-muted-foreground">{option.desc}</span>
                                                    </div>
                                                    {config.model === option.value && (
                                                        <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                                                    )}
                                                </DropdownMenuItem>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Button type="submit" size="icon" variant="ghost" disabled={isLoading || !inputValue.trim()} className="rounded-full hover:bg-muted text-muted-foreground hover:text-primary transition-colors shrink-0">
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                        </form>
                        <p className="text-center text-xs text-muted-foreground mt-2">
                            El Asistente IA puede cometer errores. Verifica la información importante en tus reportes.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Configuration Modal ── */}
            {configOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfigOpen(false)} />

                    {/* Modal */}
                    <div className="relative z-10 w-full max-w-4xl bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-[0_0_40px_-10px_rgba(0,0,0,0.3)] overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-primary/5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                    <Settings className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-lg leading-tight">Configuración de Inteligencia Artificial</h2>
                                    <p className="text-xs text-muted-foreground font-medium">Personaliza el comportamiento del modelo, voz y alcance cognitivo</p>
                                </div>
                            </div>
                            <button onClick={() => setConfigOpen(false)} className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-8 max-h-[75vh] overflow-y-auto">
                            
                            {/* Left Column - Core Settings */}
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-primary">
                                        <BrainCircuit className="h-4 w-4" /> Parámetros del Cerebro
                                    </h3>
                                    
                                    <div className="space-y-4">
                                        {/* Model */}
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Modelo Base</label>
                                            <select value={config.model} onChange={e => updateConfig({ model: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 font-medium transition-all">
                                                {AI_MODELS.map(group => (
                                                    <optgroup key={group.label} label={group.label}>
                                                        {group.options.map(option => (
                                                            <option key={option.value} value={option.value}>
                                                                {option.icon} {option.name}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Temperature */}
                                        <div className="space-y-2 pt-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Temperatura (Creatividad)</label>
                                                <span className="text-xs font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full">{config.temperature.toFixed(1)}</span>
                                            </div>
                                            <input type="range" min="0" max="1" step="0.1" value={config.temperature} onChange={e => updateConfig({ temperature: parseFloat(e.target.value) })} className="w-full accent-primary h-1.5 bg-muted rounded-full cursor-pointer appearance-none" />
                                            <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                                                <span>Analítico</span>
                                                <span>Creativo</span>
                                            </div>
                                        </div>

                                        {/* Max Tokens */}
                                        <div className="space-y-2 pt-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Límite de Tokens</label>
                                                <span className="text-xs font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full">{config.maxTokens}</span>
                                            </div>
                                            <input type="range" min="256" max="4096" step="256" value={config.maxTokens} onChange={e => updateConfig({ maxTokens: parseInt(e.target.value) })} className="w-full accent-primary h-1.5 bg-muted rounded-full cursor-pointer appearance-none" />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-border/50 pt-6">
                                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-primary">
                                        <Mic2 className="h-4 w-4" /> Configuración de Voz
                                    </h3>
                                    
                                    <div className="space-y-4">
                                        {/* Language */}
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Idioma</label>
                                            <select value={config.language} onChange={e => updateConfig({ language: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium">
                                                <option value="es">🇪🇸 Español</option>
                                                <option value="en">🇺🇸 English</option>
                                            </select>
                                        </div>

                                        {/* Voice Selection */}
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Voz del Asistente</label>
                                            <select value={config.voiceURI} onChange={e => updateConfig({ voiceURI: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium">
                                                <option value="">✨ Automático (Mejor disponible)</option>
                                                {availableVoices.map(voice => (
                                                    <option key={voice.voiceURI} value={voice.voiceURI}>
                                                        {voice.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Auto Speak Toggle */}
                                        <div className="flex items-center justify-between bg-primary/5 p-4 rounded-xl border border-primary/10 mt-2">
                                            <div className="space-y-0.5">
                                                <label className="text-xs font-bold text-primary">Lectura Automática</label>
                                                <p className="text-[10px] text-muted-foreground">La IA hablará sus respuestas en voz alta</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" className="sr-only peer" checked={config.autoSpeak} onChange={e => updateConfig({ autoSpeak: e.target.checked })} />
                                                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column - System Prompt */}
                            <div className="flex flex-col h-full bg-muted/20 p-5 rounded-2xl border border-border/50 relative overflow-hidden">
                                <div className="absolute -top-6 -right-6 p-4 opacity-5 pointer-events-none">
                                    <Bot className="h-40 w-40" />
                                </div>
                                <h3 className="text-sm font-bold flex items-center gap-2 mb-2 text-foreground z-10">
                                    <Terminal className="h-4 w-4" /> Instrucciones Adicionales (Opcional)
                                </h3>
                                <p className="text-[11px] text-muted-foreground mb-4 z-10">El asistente ya tiene programadas todas las <strong>Reglas Maestras de Control 7</strong> por defecto. Usa esta caja SÓLO si deseas agregar instrucciones adicionales, cambiar su personalidad temporalmente o darle directivas prioritarias.</p>
                                
                                <textarea
                                    value={config.systemPrompt}
                                    onChange={e => updateConfig({ systemPrompt: e.target.value })}
                                    className="flex-1 w-full bg-background border border-border rounded-xl p-4 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 text-foreground resize-none leading-relaxed min-h-[300px] z-10 shadow-inner"
                                    placeholder="Ej: A partir de ahora, responde siempre como si fueras un experto en mantenimiento industrial..."
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-6 py-5 border-t border-border bg-muted/10">
                            <button
                                onClick={() => { setConfig(DEFAULT_CONFIG); saveConfig(DEFAULT_CONFIG); }}
                                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <RotateCcw className="h-3 w-3" /> Valores de Fábrica
                            </button>
                            <button
                                onClick={() => setConfigOpen(false)}
                                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 flex items-center gap-2"
                            >
                                <Check className="h-4 w-4" /> Aplicar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

