import { lazy, Suspense, type ComponentType } from 'react';
import { Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';

const MergePage = lazy(() => import('./pages/MergePage').then((module) => ({ default: module.MergePage })));
const SplitPage = lazy(() => import('./pages/SplitPage').then((module) => ({ default: module.SplitPage })));
const OrganizePage = lazy(() => import('./pages/OrganizePage').then((module) => ({ default: module.OrganizePage })));
const EditPage = lazy(() => import('./pages/EditPage').then((module) => ({ default: module.EditPage })));
const SignPage = lazy(() => import('./pages/SignPage').then((module) => ({ default: module.SignPage })));
const PdfToImagesPage = lazy(() => import('./pages/PdfToImagesPage').then((module) => ({ default: module.PdfToImagesPage })));
const ImagesToPdfPage = lazy(() => import('./pages/ImagesToPdfPage').then((module) => ({ default: module.ImagesToPdfPage })));
const ExtractTextPage = lazy(() => import('./pages/ExtractTextPage').then((module) => ({ default: module.ExtractTextPage })));
const MetadataPage = lazy(() => import('./pages/MetadataPage').then((module) => ({ default: module.MetadataPage })));
const NupPage = lazy(() => import('./pages/NupPage').then((module) => ({ default: module.NupPage })));
const CropPage = lazy(() => import('./pages/CropPage').then((module) => ({ default: module.CropPage })));
const ProtectPage = lazy(() => import('./pages/ProtectPage').then((module) => ({ default: module.ProtectPage })));
const CompressPage = lazy(() => import('./pages/CompressPage').then((module) => ({ default: module.CompressPage })));

// New Tools
const RotatePage = lazy(() => import('./pages/RotatePage').then((module) => ({ default: module.RotatePage })));
const PageNumbersPage = lazy(() => import('./pages/PageNumbersPage').then((module) => ({ default: module.PageNumbersPage })));
const WatermarkPage = lazy(() => import('./pages/WatermarkPage').then((module) => ({ default: module.WatermarkPage })));
const RedactPage = lazy(() => import('./pages/RedactPage').then((module) => ({ default: module.RedactPage })));
const ComparePage = lazy(() => import('./pages/ComparePage').then((module) => ({ default: module.ComparePage })));
const PdfToPdfaPage = lazy(() => import('./pages/PdfToPdfaPage').then((module) => ({ default: module.PdfToPdfaPage })));
const RepairPage = lazy(() => import('./pages/RepairPage').then((module) => ({ default: module.RepairPage })));
const ScanPage = lazy(() => import('./pages/ScanPage').then((module) => ({ default: module.ScanPage })));
const HtmlToPdfPage = lazy(() => import('./pages/HtmlToPdfPage').then((module) => ({ default: module.HtmlToPdfPage })));
const ExcelToPdfPage = lazy(() => import('./pages/ExcelToPdfPage').then((module) => ({ default: module.ExcelToPdfPage })));
const PdfToExcelPage = lazy(() => import('./pages/PdfToExcelPage').then((module) => ({ default: module.PdfToExcelPage })));
const FlattenPage = lazy(() => import('./pages/FlattenPage').then((module) => ({ default: module.FlattenPage })));

const routeTable: Record<string, ComponentType> = {
  '/merge': MergePage,
  '/split': SplitPage,
  '/organize': OrganizePage,
  '/edit': EditPage,
  '/sign': SignPage,
  '/pdf-to-images': PdfToImagesPage,
  '/images-to-pdf': ImagesToPdfPage,
  '/extract-text': ExtractTextPage,
  '/metadata': MetadataPage,
  '/nup': NupPage,
  '/crop': CropPage,
  '/protect': ProtectPage,
  '/compress': CompressPage,
  '/rotate': RotatePage,
  '/page-numbers': PageNumbersPage,
  '/watermark': WatermarkPage,
  '/redact': RedactPage,
  '/compare': ComparePage,
  '/pdf-to-pdfa': PdfToPdfaPage,
  '/repair': RepairPage,
  '/scan': ScanPage,
  '/html-to-pdf': HtmlToPdfPage,
  '/excel-to-pdf': ExcelToPdfPage,
  '/pdf-to-excel': PdfToExcelPage,
  '/flatten': FlattenPage
};

export default function App() {
  return (
    <Suspense fallback={<div className="route-loading" role="status"><span>ClassTools PDF</span></div>}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        {Object.entries(routeTable).map(([path, Page]) => (
          <Route key={path} path={path} element={<Page />} />
        ))}
        <Route path="*" element={<HomePage />} />
      </Routes>
    </Suspense>
  );
}
