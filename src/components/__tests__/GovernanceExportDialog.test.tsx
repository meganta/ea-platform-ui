import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import GovernanceExportDialog from '../GovernanceExportDialog'
let mockArabic=false
jest.mock('../../contexts/LangContext',()=>({useLang:()=>({isAR:mockArabic})}))
beforeEach(()=>{mockArabic=false})
test('exports the selected PowerPoint format and language',()=>{const run=jest.fn();render(<GovernanceExportDialog onClose={jest.fn()} onExport={run}/>);fireEvent.change(screen.getByLabelText('Export format'),{target:{value:'powerpoint'}});fireEvent.change(screen.getByLabelText('Language'),{target:{value:'ar'}});fireEvent.click(screen.getByText('Generate and Download'));expect(run).toHaveBeenCalledWith('ar','powerpoint')})
test('defaults to PowerPoint in the current UI language',()=>{const run=jest.fn();render(<GovernanceExportDialog onClose={jest.fn()} onExport={run}/>);fireEvent.click(screen.getByText('Generate and Download'));expect(run).toHaveBeenCalledWith('en','powerpoint')})
test('Arabic interface defaults to Arabic and RTL',()=>{mockArabic=true;render(<GovernanceExportDialog onClose={jest.fn()} onExport={jest.fn()}/>);expect(screen.getByRole('dialog')).toHaveAttribute('dir','rtl');expect(screen.getByLabelText('اللغة')).toHaveValue('ar');expect(screen.getByRole('note')).toHaveTextContent('تبقى الاقتباسات بلغتها الأصلية')})
test('escape closes and both selects are keyboard accessible',()=>{const close=jest.fn();render(<GovernanceExportDialog onClose={close} onExport={jest.fn()}/>);expect(screen.getAllByRole('combobox')).toHaveLength(2);fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'});expect(close).toHaveBeenCalledTimes(1)})

test('Word remains selectable',()=>{const run=jest.fn();render(<GovernanceExportDialog onClose={jest.fn()} onExport={run}/>);fireEvent.change(screen.getByLabelText('Export format'),{target:{value:'word'}});fireEvent.click(screen.getByText('Generate and Download'));expect(run).toHaveBeenCalledWith('en','word')})
test('study export defaults to Arabic PowerPoint in the Arabic UI',()=>{mockArabic=true;const run=jest.fn();render(<GovernanceExportDialog subject='study' onClose={jest.fn()} onExport={run}/>);fireEvent.click(screen.getByText('إنشاء وتنزيل'));expect(run).toHaveBeenCalledWith('ar','powerpoint')})
