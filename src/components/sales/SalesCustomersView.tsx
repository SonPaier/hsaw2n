import { useState, useMemo } from 'react';
import { Search, Plus, MoreHorizontal, Phone, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface SalesCustomer {
  id: string;
  name: string;
  nip: string;
  city: string;
  caretaker: { name: string; avatar: string };
  phone: string;
  email: string;
}

const caretakers = [
  { name: 'Tomasz Kowalski', avatar: 'https://i.pravatar.cc/40?img=1' },
  { name: 'Anna Nowak', avatar: 'https://i.pravatar.cc/40?img=5' },
  { name: 'Piotr Wiśniewski', avatar: 'https://i.pravatar.cc/40?img=3' },
  { name: 'Katarzyna Zielińska', avatar: 'https://i.pravatar.cc/40?img=9' },
  { name: 'Marek Szymański', avatar: 'https://i.pravatar.cc/40?img=7' },
];

const mockCustomers: SalesCustomer[] = [
  { id: '1', name: 'Auto Detailing Kraków Sp. z o.o.', nip: '6793218745', city: 'Kraków', caretaker: caretakers[0], phone: '+48 512 345 678', email: 'biuro@autodetailing-krakow.pl' },
  { id: '2', name: 'Wrap Studio Warszawa', nip: '5272987431', city: 'Warszawa', caretaker: caretakers[1], phone: '+48 501 234 567', email: 'kontakt@wrapstudio.pl' },
  { id: '3', name: 'PPF Master Poznań', nip: '7822156390', city: 'Poznań', caretaker: caretakers[2], phone: '+48 600 111 222', email: 'info@ppfmaster.pl' },
  { id: '4', name: 'FolioTech Wrocław', nip: '8982314567', city: 'Wrocław', caretaker: caretakers[3], phone: '+48 510 987 654', email: 'zamowienia@foliotech.pl' },
  { id: '5', name: 'CarWrap Pro Gdańsk', nip: '5841276543', city: 'Gdańsk', caretaker: caretakers[4], phone: '+48 533 444 555', email: 'biuro@carwrappro.pl' },
  { id: '6', name: 'Detailing Center Łódź', nip: '7251498372', city: 'Łódź', caretaker: caretakers[0], phone: '+48 509 876 543', email: 'kontakt@detailingcenter.pl' },
  { id: '7', name: 'Auto Spa Premium Katowice', nip: '6342178905', city: 'Katowice', caretaker: caretakers[1], phone: '+48 502 333 444', email: 'info@autospa-premium.pl' },
  { id: '8', name: 'Shield Car Studio Lublin', nip: '7123465890', city: 'Lublin', caretaker: caretakers[2], phone: '+48 515 222 333', email: 'studio@shieldcar.pl' },
  { id: '9', name: 'MaxProtect Szczecin', nip: '8512347689', city: 'Szczecin', caretaker: caretakers[3], phone: '+48 601 555 666', email: 'biuro@maxprotect.pl' },
  { id: '10', name: 'Elite Detailing Białystok', nip: '5421389076', city: 'Białystok', caretaker: caretakers[4], phone: '+48 512 777 888', email: 'kontakt@elitedetailing.pl' },
  { id: '11', name: 'ProWrap Bydgoszcz', nip: '5541267834', city: 'Bydgoszcz', caretaker: caretakers[0], phone: '+48 504 111 999', email: 'info@prowrap.pl' },
  { id: '12', name: 'PPF Expert Rzeszów', nip: '8131456723', city: 'Rzeszów', caretaker: caretakers[1], phone: '+48 530 222 111', email: 'biuro@ppfexpert.pl' },
  { id: '13', name: 'GlassGuard Opole', nip: '7541238906', city: 'Opole', caretaker: caretakers[2], phone: '+48 511 333 222', email: 'zamowienia@glassguard.pl' },
  { id: '14', name: 'FilmPro Kielce', nip: '6571234890', city: 'Kielce', caretaker: caretakers[3], phone: '+48 508 444 333', email: 'kontakt@filmpro.pl' },
  { id: '15', name: 'WrapMaster Toruń', nip: '8792134567', city: 'Toruń', caretaker: caretakers[4], phone: '+48 516 555 444', email: 'biuro@wrapmaster.pl' },
];

const ITEMS_PER_PAGE = 10;

const SalesCustomersView = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search.trim()) return mockCustomers;
    const q = search.toLowerCase();
    return mockCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.nip.includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [search]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj klienta..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Button size="sm" className="gap-2" onClick={() => toast.info('Formularz dodawania klienta')}>
          <Plus className="w-4 h-4" />
          Dodaj klienta
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Nazwa</TableHead>
              <TableHead>NIP</TableHead>
              <TableHead>Miasto</TableHead>
              <TableHead>Opiekun</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Brak wyników
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((c) => (
                <TableRow key={c.id} className="hover:bg-[#F1F5F9]">
                  <TableCell className="font-medium max-w-[220px] truncate">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{c.nip}</TableCell>
                  <TableCell>{c.city}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={c.caretaker.avatar} alt={c.caretaker.name} />
                        <AvatarFallback className="text-[10px]">{c.caretaker.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate">{c.caretaker.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="text-primary hover:underline text-sm whitespace-nowrap">
                      {c.phone}
                    </a>
                  </TableCell>
                  <TableCell>
                    <a href={`mailto:${c.email}`} className="text-primary hover:underline text-sm truncate block max-w-[200px]">
                      {c.email}
                    </a>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toast.info('Utwórz zamówienie')}>Utwórz zamówienie</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info('Edytuj')}>Edytuj</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => toast.info('Usuń')}>Usuń</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length} klientów
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesCustomersView;
