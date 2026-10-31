import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  AppShell,
  Button,
  CategoryIcon,
  DateText,
  EmptyState,
  Field,
  Input,
  KeyValue,
  Modal,
  Money,
  PageHeader,
  Select,
  Skeleton,
  StatusChip,
  Table,
  Tabs,
  ThemeProvider,
  ToastProvider,
  useToast,
} from '../index';

describe('components', () => {
  it('renders button variants with their class', () => {
    render(
      <>
        <Button>Save</Button>
        <Button variant="secondary">Cancel</Button>
        <Button variant="ghost">More</Button>
        <Button variant="danger">Freeze</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('og-btn--primary');
    expect(screen.getByRole('button', { name: 'Freeze' })).toHaveClass('og-btn--danger');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('type', 'button');
  });

  it('status chips always carry text, not colour alone', () => {
    render(<StatusChip status="pending">Pending approval</StatusChip>);
    expect(screen.getByText('Pending approval')).toHaveAttribute('data-status', 'pending');
  });

  it('formats money and dates in house style', () => {
    render(
      <>
        <Money value={{ amount: '1250.00', currency: 'USD' }} />
        <DateText value="2026-10-20T14:42:00Z" time />
      </>,
    );
    expect(screen.getByText('US$1,250.00')).toHaveClass('og-money');
    expect(screen.getByText('20 Oct 2026 10:42 ET')).toHaveAttribute('dateTime', '2026-10-20T14:42:00Z');
  });

  it('table sorts by column and shows the empty state', async () => {
    const rows = [
      { id: 'a', name: 'Lumen Trade LLC', n: 2 },
      { id: 'b', name: 'GBK Services LLC', n: 5 },
    ];
    const cols = [
      {
        key: 'name',
        header: 'Name',
        render: (r: (typeof rows)[0]) => r.name,
        sortValue: (r: (typeof rows)[0]) => r.name,
      },
      {
        key: 'n',
        header: 'Count',
        render: (r: (typeof rows)[0]) => r.n,
        sortValue: (r: (typeof rows)[0]) => r.n,
        align: 'end' as const,
      },
    ];
    const { rerender } = render(
      <Table caption="Companies" columns={cols} rows={rows} rowKey={(r) => r.id} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Name/ }));
    const body = screen.getAllByRole('row').slice(1);
    expect(within(body[0]!).getByText('GBK Services LLC')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(within(screen.getAllByRole('row')[1]!).getByText('Lumen Trade LLC')).toBeInTheDocument();

    rerender(
      <Table caption="Companies" columns={cols} rows={[]} rowKey={(r) => r.id} empty="No companies yet." />,
    );
    expect(screen.getByText('No companies yet.')).toBeInTheDocument();
  });

  it('field links label, hint and error to the control', () => {
    render(
      <Field label="Reason" hint="Shown in the audit log" error="A reason is required.">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Reason');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toMatch(/hint.*err/);
  });

  it('select renders its options', () => {
    render(
      <Select
        aria-label="Mode"
        options={[
          { value: 'mock', label: 'Mock' },
          { value: 'live', label: 'Live' },
        ]}
      />,
    );
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('tabs switch with arrow keys', async () => {
    function T() {
      const [v, setV] = useState('a');
      return (
        <Tabs
          label="Settings"
          value={v}
          onChange={setV}
          items={[
            { id: 'a', label: 'Appearance', content: 'A panel' },
            { id: 'b', label: 'API', content: 'B panel' },
          ]}
        />
      );
    }
    render(<T />);
    screen.getByRole('tab', { name: 'Appearance' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'API' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('B panel');
  });

  it('modal traps focus, closes on Escape and returns focus to the trigger', async () => {
    function M() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Open</Button>
          <Modal open={open} title="Relink" onClose={() => setOpen(false)} footer={<Button>Confirm</Button>}>
            <Input aria-label="Reference" />
          </Modal>
        </>
      );
    }
    render(<M />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Relink' })).toBeInTheDocument();
    expect(screen.getByLabelText('Reference')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText('Reference')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('toast shows a message', async () => {
    function T() {
      const toast = useToast();
      return <Button onClick={() => toast.show('Version 4 saved.', 'success')}>Go</Button>;
    }
    render(
      <ToastProvider timeoutMs={0}>
        <T />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(screen.getByText('Version 4 saved.')).toBeInTheDocument();
  });

  it('skeleton, empty state, key value, page header and category tile render', () => {
    render(
      <>
        <Skeleton label="Loading workflows." />
        <EmptyState title="Nothing needs ops right now." category="compliance" />
        <KeyValue items={[{ label: 'Partner company reference', value: 'gz_77810' }]} />
        <PageHeader title="Workflows" eyebrow="Ops" />
        <CategoryIcon category="banking" label="Banking" />
      </>,
    );
    expect(screen.getByRole('status', { name: 'Loading workflows.' })).toBeInTheDocument();
    expect(screen.getByText('Nothing needs ops right now.')).toBeInTheDocument();
    expect(screen.getByText('gz_77810')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Workflows' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Banking' })).toHaveClass('og-cat--banking');
  });

  it('app shell shows the logo from the theme, the environment badge and switches theme', async () => {
    render(
      <ThemeProvider>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppShell nav={[{ to: '/', label: 'Overview' }]} environment={{ label: 'Mock data', tone: 'mock' }}>
            <p>content</p>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByRole('img', { name: 'OnGem' })).toBeInTheDocument();
    expect(screen.getByTestId('env-badge')).toHaveTextContent('Mock data');
    await userEvent.selectOptions(screen.getByLabelText('Theme'), 'demo-harbor');
    expect(screen.getByText('Harbor', { selector: '.og-logo--text' })).toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue('--color-brand-primary')).toBe('#0F766E');
  });
});
