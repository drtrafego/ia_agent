'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * VARIABLE SELECTOR - Seletor de variáveis com categorias predefinidas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Similar ao sistema da Zaia, permite selecionar variáveis de categorias ou criar customizadas.
 */

import { useState } from 'react';
import { X, Plus, Search, User, Briefcase, MapPin, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface VariableOption {
    name: string;
    label: string;
    description: string;
    category: 'identification' | 'professional' | 'location' | 'qualification';
}

interface VariableSelectorProps {
    selectedVariables: string[];
    onVariablesChange: (variables: string[]) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// PREDEFINED VARIABLES
// ─────────────────────────────────────────────────────────────────────────────

const PREDEFINED_VARIABLES: VariableOption[] = [
    // Identificação
    { name: 'data.nome', label: 'Nome', description: 'Nome completo do lead', category: 'identification' },
    { name: 'data.email', label: 'E-mail', description: 'Endereço de e-mail', category: 'identification' },
    { name: 'data.telefone', label: 'Telefone', description: 'Número de telefone', category: 'identification' },
    { name: 'data.cpf', label: 'CPF', description: 'CPF do lead', category: 'identification' },

    // Profissional
    { name: 'data.empresa', label: 'Empresa', description: 'Nome da empresa', category: 'professional' },
    { name: 'data.cargo', label: 'Cargo', description: 'Cargo/função', category: 'professional' },
    { name: 'data.setor', label: 'Setor', description: 'Setor/departamento', category: 'professional' },
    { name: 'data.tamanho_empresa', label: 'Tamanho Empresa', description: 'Quantidade de funcionários', category: 'professional' },

    // Localização
    { name: 'data.cidade', label: 'Cidade', description: 'Cidade do lead', category: 'location' },
    { name: 'data.estado', label: 'Estado', description: 'Estado/UF', category: 'location' },
    { name: 'data.endereco', label: 'Endereço', description: 'Endereço completo', category: 'location' },
    { name: 'data.cep', label: 'CEP', description: 'Código postal', category: 'location' },

    // Qualificação
    { name: 'data.interesse', label: 'Interesse', description: 'Produto/serviço de interesse', category: 'qualification' },
    { name: 'data.orcamento', label: 'Orçamento', description: 'Faixa de orçamento', category: 'qualification' },
    { name: 'data.urgencia', label: 'Urgência', description: 'Prazo de decisão', category: 'qualification' },
    { name: 'data.origem', label: 'Origem', description: 'Como conheceu', category: 'qualification' },
];

const CATEGORIES = {
    identification: { icon: User, label: 'Identificação', color: 'text-blue-600 bg-blue-50' },
    professional: { icon: Briefcase, label: 'Profissional', color: 'text-purple-600 bg-purple-50' },
    location: { icon: MapPin, label: 'Localização', color: 'text-green-600 bg-green-50' },
    qualification: { icon: Target, label: 'Qualificação', color: 'text-orange-600 bg-orange-50' },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function VariableSelector({ selectedVariables, onVariablesChange }: VariableSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [customVariableName, setCustomVariableName] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const handleToggleVariable = (varName: string) => {
        if (selectedVariables.includes(varName)) {
            onVariablesChange(selectedVariables.filter(v => v !== varName));
        } else {
            onVariablesChange([...selectedVariables, varName]);
        }
    };

    const handleAddCustom = () => {
        if (!customVariableName.trim()) return;

        // Normalizar nome (adicionar data. se necessário)
        const normalized = customVariableName.startsWith('data.')
            ? customVariableName
            : `data.${customVariableName.toLowerCase().replace(/\s+/g, '_')}`; if (!selectedVariables.includes(normalized)) {
                onVariablesChange([...selectedVariables, normalized]);
            }

        setCustomVariableName('');
        setIsOpen(false);
    };

    // Filtrar variáveis
    const filteredVariables = PREDEFINED_VARIABLES.filter(v => {
        const matchesSearch = searchQuery === '' ||
            v.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            v.description.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCategory = !selectedCategory || v.category === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    // Agrupar por categoria
    const groupedVariables = filteredVariables.reduce((acc, v) => {
        if (!acc[v.category]) acc[v.category] = [];
        acc[v.category].push(v);
        return acc;
    }, {} as Record<string, VariableOption[]>);

    return (
        <div className="space-y-2">
            {/* Selected Variables */}
            <div className="flex flex-wrap gap-2 min-h-[40px]">
                {selectedVariables.map((variable) => (
                    <span
                        key={variable}
                        className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-sm"
                    >
                        {variable}
                        <button
                            onClick={() => handleToggleVariable(variable)}
                            className="hover:text-blue-900"
                            aria-label={`Remover ${variable}`}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
            </div>

            {/* Add Variable Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Variável
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Selecione ou Crie Variáveis</DialogTitle>
                        <DialogDescription>
                            Escolha variáveis predefinidas ou crie uma customizada
                        </DialogDescription>
                    </DialogHeader>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar variáveis..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {/* Category Filters */}
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={cn(
                                "px-3 py-1 rounded-lg text-sm whitespace-nowrap transition",
                                selectedCategory === null
                                    ? 'bg-slate-800 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            )}
                        >
                            Todas
                        </button>
                        {Object.entries(CATEGORIES).map(([key, cat]) => (
                            <button
                                key={key}
                                onClick={() => setSelectedCategory(selectedCategory === key ? null : key)}
                                className={cn(
                                    "px-3 py-1 rounded-lg text-sm whitespace-nowrap transition flex items-center gap-2",
                                    selectedCategory === key
                                        ? 'bg-slate-800 text-white'
                                        : `${cat.color} hover:opacity-80`
                                )}
                            >
                                <cat.icon className="h-3 w-3" />
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Variables List */}
                    <div className="flex-1 overflow-y-auto space-y-4">
                        {Object.entries(groupedVariables).map(([categoryKey, variables]) => {
                            const category = CATEGORIES[categoryKey as keyof typeof CATEGORIES];
                            const Icon = category.icon;

                            return (
                                <div key={categoryKey}>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                        <Icon className="h-4 w-4" />
                                        {category.label}
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {variables.map((variable) => {
                                            const isSelected = selectedVariables.includes(variable.name);
                                            return (
                                                <button
                                                    key={variable.name}
                                                    onClick={() => handleToggleVariable(variable.name)}
                                                    className={cn(
                                                        "text-left p-3 rounded-lg border-2 transition",
                                                        isSelected
                                                            ? 'border-blue-500 bg-blue-50'
                                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                                    )}
                                                >
                                                    <p className="font-medium text-sm">{variable.label}</p>
                                                    <p className="text-xs text-slate-500 mt-1">{variable.description}</p>
                                                    <p className="text-xs font-mono text-slate-400 mt-1">{variable.name}</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Custom Variable */}
                    <div className="border-t pt-4 space-y-2">
                        <Label className="text-sm font-semibold">Criar Variável Customiz ada</Label>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Ex: projeto, referencia, observacao"
                                value={customVariableName}
                                onChange={(e) => setCustomVariableName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
                            />
                            <Button onClick={handleAddCustom} disabled={!customVariableName.trim()}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500">
                            A variável será criada automaticamente como <code className="bg-slate-100 px-1 rounded">data.seu_nome</code>
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
