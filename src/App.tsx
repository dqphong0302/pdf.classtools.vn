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
  '/compress': CompressPage
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
