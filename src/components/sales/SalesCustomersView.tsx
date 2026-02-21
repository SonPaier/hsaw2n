import React, { useState, useMemo } from 'react';
import { Search, Plus, MoreHorizontal, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  caretaker: { name: string };
  phone: string;
  email: string;
  billingStreet?: string;
  billingCity?: string;
  billingPostalCode?: string;
  shippingStreet?: string;
  shippingCity?: string;
  shippingPostalCode?: string;
  contactPerson?: string;
  vatEu?: string;
  notes?: string;
}

const caretakers = [
  { name: 'Anna Nowak' },
  { name: 'Katarzyna Zielińska' },
  { name: 'Tomasz Kowalski' },
];

const mockCustomers: SalesCustomer[] = [
  { id: '1', name: 'Auto Detailing Kraków Sp. z o.o.', nip: '6793218745', city: 'Kraków', caretaker: caretakers[0], phone: '+48 512 345 678', email: 'biuro@autodetailing-krakow.pl', billingStreet: 'ul. Przemysłowa 12', billingCity: 'Kraków', billingPostalCode: '30-701', shippingStreet: 'ul. Przemysłowa 12', shippingCity: 'Kraków', shippingPostalCode: '30-701', contactPerson: 'Jan Kowalski' },
  { id: '2', name: 'Wrap Studio Warszawa', nip: '5272987431', city: 'Warszawa', caretaker: caretakers[1], phone: '+48 501 234 567', email: 'kontakt@wrapstudio.pl', billingStreet: 'ul. Wolska 88/3', billingCity: 'Warszawa', billingPostalCode: '01-003', shippingStreet: 'ul. Wolska 88/3', shippingCity: 'Warszawa', shippingPostalCode: '01-003', contactPerson: 'Marta Wiśniewska' },
  { id: '3', name: 'PPF Master Poznań', nip: '7822156390', city: 'Poznań', caretaker: caretakers[2], phone: '+48 600 111 222', email: 'info@ppfmaster.pl', billingStreet: 'ul. Głogowska 45', billingCity: 'Poznań', billingPostalCode: '60-736', shippingStreet: 'ul. Marcelińska 10', shippingCity: 'Poznań', shippingPostalCode: '60-801', contactPerson: 'Piotr Szymański' },
  { id: '4', name: 'FolioTech Wrocław', nip: '8982314567', city: 'Wrocław', caretaker: caretakers[0], phone: '+48 510 987 654', email: 'zamowienia@foliotech.pl', billingStreet: 'ul. Strzegomska 140', billingCity: 'Wrocław', billingPostalCode: '54-429', shippingStreet: 'ul. Strzegomska 140', shippingCity: 'Wrocław', shippingPostalCode: '54-429', vatEu: 'PL8982314567' },
  { id: '5', name: 'CarWrap Pro Gdańsk', nip: '5841276543', city: 'Gdańsk', caretaker: caretakers[1], phone: '+48 533 444 555', email: 'biuro@carwrappro.pl', billingStreet: 'ul. Marynarki Polskiej 71', billingCity: 'Gdańsk', billingPostalCode: '80-557', shippingStreet: 'ul. Marynarki Polskiej 71', shippingCity: 'Gdańsk', shippingPostalCode: '80-557' },
  { id: '6', name: 'Detailing Center Łódź', nip: '7251498372', city: 'Łódź', caretaker: caretakers[2], phone: '+48 509 876 543', email: 'kontakt@detailingcenter.pl', billingStreet: 'ul. Piotrkowska 200', billingCity: 'Łódź', billingPostalCode: '90-369', shippingStreet: 'ul. Piotrkowska 200', shippingCity: 'Łódź', shippingPostalCode: '90-369', contactPerson: 'Adam Nowicki' },
  { id: '7', name: 'Auto Spa Premium Katowice', nip: '6342178905', city: 'Katowice', caretaker: caretakers[0], phone: '+48 502 333 444', email: 'info@autospa-premium.pl', billingStreet: 'ul. Chorzowska 50', billingCity: 'Katowice', billingPostalCode: '40-121', shippingStreet: 'ul. Chorzowska 50', shippingCity: 'Katowice', shippingPostalCode: '40-121' },
  { id: '8', name: 'Shield Car Studio Lublin', nip: '7123465890', city: 'Lublin', caretaker: caretakers[1], phone: '+48 515 222 333', email: 'studio@shieldcar.pl', billingStreet: 'ul. Krakowskie Przedmieście 5', billingCity: 'Lublin', billingPostalCode: '20-002', shippingStreet: 'ul. Lubartowska 30', shippingCity: 'Lublin', shippingPostalCode: '20-094', contactPerson: 'Ewa Kamińska', vatEu: 'PL7123465890' },
  { id: '9', name: 'MaxProtect Szczecin', nip: '8512347689', city: 'Szczecin', caretaker: caretakers[2], phone: '+48 601 555 666', email: 'biuro@maxprotect.pl', billingStreet: 'al. Wojska Polskiego 100', billingCity: 'Szczecin', billingPostalCode: '70-482', shippingStreet: 'al. Wojska Polskiego 100', shippingCity: 'Szczecin', shippingPostalCode: '70-482' },
  { id: '10', name: 'Elite Detailing Białystok', nip: '5421389076', city: 'Białystok', caretaker: caretakers[0], phone: '+48 512 777 888', email: 'kontakt@elitedetailing.pl', billingStreet: 'ul. Lipowa 20', billingCity: 'Białystok', billingPostalCode: '15-424', shippingStreet: 'ul. Lipowa 20', shippingCity: 'Białystok', shippingPostalCode: '15-424', contactPerson: 'Marek Lewandowski' },
  { id: '11', name: 'ProWrap Bydgoszcz', nip: '5541267834', city: 'Bydgoszcz', caretaker: caretakers[1], phone: '+48 504 111 999', email: 'info@prowrap.pl', billingStreet: 'ul. Gdańska 15', billingCity: 'Bydgoszcz', billingPostalCode: '85-005', shippingStreet: 'ul. Gdańska 15', shippingCity: 'Bydgoszcz', shippingPostalCode: '85-005' },
  { id: '12', name: 'PPF Expert Rzeszów', nip: '8131456723', city: 'Rzeszów', caretaker: caretakers[2], phone: '+48 530 222 111', email: 'biuro@ppfexpert.pl', billingStreet: 'ul. Rejtana 8', billingCity: 'Rzeszów', billingPostalCode: '35-310', shippingStreet: 'ul. Rejtana 8', shippingCity: 'Rzeszów', shippingPostalCode: '35-310' },
  { id: '13', name: 'GlassGuard Opole', nip: '7541238906', city: 'Opole', caretaker: caretakers[0], phone: '+48 511 333 222', email: 'zamowienia@glassguard.pl', billingStreet: 'ul. Ozimska 44', billingCity: 'Opole', billingPostalCode: '45-058', shippingStreet: 'ul. Ozimska 44', shippingCity: 'Opole', shippingPostalCode: '45-058', contactPerson: 'Tomasz Dąbrowski' },
  { id: '14', name: 'FilmPro Kielce', nip: '6571234890', city: 'Kielce', caretaker: caretakers[1], phone: '+48 508 444 333', email: 'kontakt@filmpro.pl', billingStreet: 'ul. Sienkiewicza 30', billingCity: 'Kielce', billingPostalCode: '25-507', shippingStreet: 'ul. Sienkiewicza 30', shippingCity: 'Kielce', shippingPostalCode: '25-507' },
  { id: '15', name: 'WrapMaster Toruń', nip: '8792134567', city: 'Toruń', caretaker: caretakers[2], phone: '+48 516 555 444', email: 'biuro@wrapmaster.pl', billingStreet: 'ul. Szeroka 12', billingCity: 'Toruń', billingPostalCode: '87-100', shippingStreet: 'ul. Podmurna 5', shippingCity: 'Toruń', shippingPostalCode: '87-100', contactPerson: 'Krzysztof Wójcik', vatEu: 'PL8792134567' },
];

const ITEMS_PER_PAGE = 10;

const SalesCustomersView = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Klienci</h2>
      </div>

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

      <div className="border rounded-lg overflow-hidden bg-white dark:bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[30px]" />
              <TableHead>Nazwa</TableHead>
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
              paginated.map((c) => {
                const isExpanded = expandedRows.has(c.id);
                return (
                  <React.Fragment key={c.id}>
                    <TableRow className="hover:bg-[#F1F5F9] cursor-pointer" onClick={() => toggleExpand(c.id)}>
                      <TableCell className="pr-0">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="font-medium max-w-[220px] truncate">{c.name}</TableCell>
                      <TableCell>{c.city}</TableCell>
                      <TableCell>
                        <span className="text-sm truncate">{c.caretaker.name}</span>
                      </TableCell>
                      <TableCell>
                        <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="text-primary hover:underline text-sm whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {c.phone}
                        </a>
                      </TableCell>
                      <TableCell>
                        <a href={`mailto:${c.email}`} className="text-primary hover:underline text-sm truncate block max-w-[200px]" onClick={(e) => e.stopPropagation()}>
                          {c.email}
                        </a>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
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
                    {isExpanded && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="p-0">
                          <div className="bg-white dark:bg-card px-8 py-4 grid grid-cols-3 gap-6 text-sm border-t">
                            <div>
                              <p className="text-muted-foreground text-xs font-medium mb-1">NIP</p>
                              <p>{c.nip}</p>
                              {c.vatEu && (
                                <>
                                  <p className="text-muted-foreground text-xs font-medium mb-1 mt-3">VAT EU</p>
                                  <p>{c.vatEu}</p>
                                </>
                              )}
                              {c.contactPerson && (
                                <>
                                  <p className="text-muted-foreground text-xs font-medium mb-1 mt-3">Osoba kontaktowa</p>
                                  <p>{c.contactPerson}</p>
                                </>
                              )}
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs font-medium mb-1">Adres faktury</p>
                              {c.billingStreet ? (
                                <>
                                  <p>{c.billingStreet}</p>
                                  <p>{c.billingPostalCode} {c.billingCity}</p>
                                </>
                              ) : (
                                <p className="text-muted-foreground">—</p>
                              )}
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs font-medium mb-1">Adres wysyłki</p>
                              {c.shippingStreet ? (
                                <>
                                  <p>{c.shippingStreet}</p>
                                  <p>{c.shippingPostalCode} {c.shippingCity}</p>
                                </>
                              ) : (
                                <p className="text-muted-foreground">—</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Strona {page} z {totalPages} ({filtered.length} klientów)
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeftIcon className="w-4 h-4" />
              Poprzednia
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" className="w-9" onClick={() => setPage(p)}>
                {p}
              </Button>
            ))}
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              Następna
              <ChevronRightIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesCustomersView;
