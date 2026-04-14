'use client';

import { create } from '@orama/orama';
import { useDocsSearch } from 'fumadocs-core/search/client';
import {
	SearchDialog,
	SearchDialogClose,
	SearchDialogContent,
	SearchDialogHeader,
	SearchDialogIcon,
	SearchDialogInput,
	SearchDialogList,
	SearchDialogOverlay,
	type SharedProps,
} from 'fumadocs-ui/components/dialog/search';
import { withBasePath } from '@/lib/site';

function initOrama() {
	return create({
		schema: { _: 'string' },
		language: 'english',
	});
}

export function StaticSearchDialog(props: SharedProps) {
	const { search, setSearch, query } = useDocsSearch({
		from: withBasePath('/api/search'),
		initOrama,
		type: 'static',
	});

	return (
		<SearchDialog search={search} onSearchChange={setSearch} isLoading={query.isLoading} {...props}>
			<SearchDialogOverlay />
			<SearchDialogContent>
				<SearchDialogHeader>
					<SearchDialogIcon />
					<SearchDialogInput />
					<SearchDialogClose />
				</SearchDialogHeader>
				<SearchDialogList items={query.data !== 'empty' ? query.data : null} />
			</SearchDialogContent>
		</SearchDialog>
	);
}
